// This module was written with the help of ChatGPT, with some manual adjustments and fixes

import { client, HF_MODEL } from "@/lib/inference";
import { composeReportReason, normalizeAdditionalComment, SYSTEM_REPORT_REASON_CODE } from "@/lib/reportReasons";

export const DEFAULT_REVIEW_THRESHOLD = Number(process.env.MODERATION_REVIEW_THRESHOLD || 35);
export const DEFAULT_BLOCK_THRESHOLD = Number(process.env.MODERATION_BLOCK_THRESHOLD || 70);
// toxicity scores at or above this threshold are treated as potentially inappropriate.
export const DEFAULT_FLAG_THRESHOLD = Number(process.env.MODERATION_FLAG_THRESHOLD || DEFAULT_REVIEW_THRESHOLD);

/**
 * Convert toxicity score to a value between 0 and 100
 */
function normalizeToxicityScore(score: number) {
    if (Number.isNaN(score)) return 0;
    return Math.max(0, Math.min(100, score));
}

function deriveVerdictFromToxicity(
    toxicityScore: number,
    reviewThreshold = DEFAULT_REVIEW_THRESHOLD,
    blockThreshold = DEFAULT_BLOCK_THRESHOLD,
) {
    if (toxicityScore >= blockThreshold) return "block";
    if (toxicityScore >= reviewThreshold) return "review";
    return "safe";
}


function stripCodeFences(text = "") {
    return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "");
}

function safeParse(jsonLike: string) {
    try {
        return JSON.parse(jsonLike);
    } catch (err) {
        const match = jsonLike.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (e) {
                return null;
            }
        }
        return null;
    }
}

/**
 * Call the HF inference API to get a moderation verdict for the provided content.
 * Returns an object containing the normalized verdict (safe|review|block), a 0-100 toxicityScore, and a short explanation.
 */
type ModerationResult = {
    verdict: "safe" | "review" | "block";
    toxicityScore: number;
    explanation: string | null;
    raw: string | null;
};

export async function runModerationCheck({ content, context = "sports fan discussion" }: { content: string; context?: string }): Promise<ModerationResult> {
    if (!content || typeof content !== "string") {
        return { verdict: "safe", toxicityScore: 0, explanation: "Empty content", raw: null };
    }

    const systemPrompt = [
        "You are a concise content moderator for a sports discussion forum.",
        "Assess the user's message for toxicity, abuse, hate, harassment, and threats.",
        "Do not provide a moderation verdict label.",
        "Respond ONLY with a JSON object:{\"toxicityScore\":number_0_to_100,\"explanation\":\"short reason\"}.",
        "Use higher scores for more severe policy violations.",
    ].join(" ");

    const userPrompt = [
        `Context: ${context}`,
        "Message:",
        content.trim().slice(0, 2000),
        "Return only the JSON object.",
    ].join("\n\n");

    console.log("ai moderation check, str len:", systemPrompt.length + userPrompt.length);

    let raw = "";
    try {
        const res = await client.chatCompletion({
            model: HF_MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
        });
        raw = res?.choices?.[0]?.message?.content || "";
    } catch (err) {
        console.error("moderation inference failed", err);
        return { verdict: "review", toxicityScore: 1, explanation: "Inference unavailable", raw: null };
    }

    const cleaned = stripCodeFences(raw);
    const parsed = safeParse(cleaned) || {};
    const toxicityScore = normalizeToxicityScore(Number(parsed.toxicityScore ?? parsed.score));
    const verdict = deriveVerdictFromToxicity(toxicityScore);
    const explanation = typeof parsed.explanation === "string"
        ? parsed.explanation.slice(0, 500)
        : null;

    return { verdict, toxicityScore: toxicityScore, explanation, raw: cleaned };
}

/**
 * Return whether teh content should be flagged based on the moderation result and configured threshold
 */
export function shouldFlagContent({ verdict, toxicityScore }: { verdict: string; toxicityScore: number }, threshold = DEFAULT_FLAG_THRESHOLD) {
    if (!verdict) return false;
    if (verdict === "block") return true;
    if (verdict === "review") return true;
    return Number(toxicityScore) >= threshold;
}

type ThreadMoodPostInput = {
    id: number;
    content: string;
};

/**
 * Store a thread-level AI verdict using broader context (first and recent posts).
 * This updates moderation context each time a thread is reported.
 */
export async function storeThreadMoodModerationVerdict(threadId: number, title: string, posts: ThreadMoodPostInput[]) {
    const { prisma } = await import("@/lib/db");
    try {
        if (!Array.isArray(posts) || posts.length === 0) return null;

        const firstFive = posts.slice(0, 5);
        const lastFive = posts.slice(Math.max(posts.length - 5, 0));
        const anchorPostId = firstFive[0]?.id ?? lastFive[0]?.id;
        if (!anchorPostId) return null;

        const firstSection = firstFive
            .map((post, index) => `First ${index + 1}: ${String(post.content || "").slice(0, 500)}`)
            .join("\n");
        const recentSection = lastFive
            .map((post, index) => `Recent ${index + 1}: ${String(post.content || "").slice(0, 500)}`)
            .join("\n");

        const combined = [
            `Thread title: ${title}`,
            "Opening posts:",
            firstSection,
            "Recent posts:",
            recentSection,
        ].join("\n\n");

        const result = await runModerationCheck({
            content: combined,
            context: "forum thread mood from first and most recent discussion posts",
        });

        return await prisma.aiModerationVerdict.create({
            data: {
                postId: anchorPostId,
                verdict: result.verdict,
                toxicityScore: result.toxicityScore,
                explanation: result.explanation,
                contentSnapshot: combined.slice(0, 2000),
                rawResponse: result.raw ? { raw: result.raw } : undefined,
            },
        });
    } catch (err) {
        console.error("Failed to store thread mood moderation verdict", err);
        return null;
    }
}

/**
 * Run AI moderation for a thread (title + first post combined in one AI call).
 * Stores the verdict against the initial post, and if flagged creates a THREAD-level report.
 * If blocked, the caller is responsible for hiding both the thread and the post.
 * Returns the created AiModerationVerdict record (with verdict field), or null on failure.
 * Errors are logged but never thrown — callers should not block on this.
 */
export async function storeModerationForThread(threadId: number, postId: number, title: string, content: string) {
    const { prisma } = await import("@/lib/db");
    try {
        const combined = `Thread title: ${title}\n\n${content}`;
        const result = await runModerationCheck({ content: combined, context: "forum thread title and first post" });
        const verdictRecord = await prisma.aiModerationVerdict.create({
            data: {
                postId,
                verdict: result.verdict,
                toxicityScore: result.toxicityScore,
                explanation: result.explanation,
                contentSnapshot: combined.slice(0, 2000),
                rawResponse: result.raw ? { raw: result.raw } : undefined,
            },
        });

        if (shouldFlagContent(result)) {
            const additionalComment = normalizeAdditionalComment(result.explanation, 500);
            const reason = composeReportReason(SYSTEM_REPORT_REASON_CODE, additionalComment);
            const report = await prisma.report.create({
                data: {
                    reporterId: null,
                    targetType: "THREAD",
                    targetId: threadId,
                    reasonCode: SYSTEM_REPORT_REASON_CODE,
                    additionalComment,
                    reason,
                },
            });

            await prisma.aiModerationVerdict.update({
                where: { id: verdictRecord.id },
                data: { reportId: report.id },
            });
        }

        return verdictRecord;
    } catch (err) {
        console.error("Failed to store thread moderation verdict", err);
        return null;
    }
}

/**
 * Run AI moderation for a post, store the verdict, and auto-create a report if flagged.
 * Returns the created AiModerationVerdict record (with verdict field), or null on failure.
 * Errors are logged but never thrown — callers should not block on this.
 */
export async function storeModerationForPost(postId: number, content: string) {
    const { prisma } = await import("@/lib/db");
    try {
        const result = await runModerationCheck({ content, context: "forum post" });
        const verdictRecord = await prisma.aiModerationVerdict.create({
            data: {
                postId,
                verdict: result.verdict,
                toxicityScore: result.toxicityScore,
                explanation: result.explanation,
                contentSnapshot: content.slice(0, 2000),
                rawResponse: result.raw ? { raw: result.raw } : undefined,
            },
        });

        if (shouldFlagContent(result)) {
            const additionalComment = normalizeAdditionalComment(result.explanation, 500);
            const reason = composeReportReason(SYSTEM_REPORT_REASON_CODE, additionalComment);
            const report = await prisma.report.create({
                data: {
                    reporterId: null,
                    targetType: "POST",
                    targetId: postId,
                    reasonCode: SYSTEM_REPORT_REASON_CODE,
                    additionalComment,
                    reason,
                },
            });

            await prisma.aiModerationVerdict.update({
                where: { id: verdictRecord.id },
                data: { reportId: report.id },
            });
        }

        return verdictRecord;
    } catch (err) {
        console.error("Failed to store moderation verdict", err);
        return null;
    }
}
