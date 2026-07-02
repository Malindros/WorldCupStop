// This module was written with the help of ChatGPT, with some manual changes and additions.

import { prisma } from "@/lib/db";
import { client, HF_MODEL } from "@/lib/inference";

const MAX_POSTS = Number(process.env.SENTIMENT_MAX_POSTS || 50); // Limit number of posts to analyze to reduce costs
const MAX_CHARS_PER_POST = Number(process.env.SENTIMENT_MAX_CHARS_PER_POST || 600); // Limit characters to reduce costs
const SCORE_MIN = 0;
const SCORE_MAX = 100;
const NEGATIVE_MAX = 35;
const POSITIVE_MIN = 65;

/**
 * Clamp a score into the canonical 0-100 range.
 */
function clampPercentScore(score: number) {
    if (!Number.isFinite(score)) return 50;
    return Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
}

function scoreToSentiment(score: number) {
    if (score < NEGATIVE_MAX) return "negative";
    if (score >= POSITIVE_MIN) return "positive";
    return "neutral";
}

/**
 * Normalize score into canonical 0-100 and derive sentiment label from thresholds.
 */
export function normalizeSentimentRecord({ score }: { score: unknown }) {
    const numeric = Number(score);
    const clamped = clampPercentScore(numeric);
    return { sentiment: scoreToSentiment(clamped), score: clamped };
}

/**
 * Cleans whitespace, truncates, and numbers posts for better formatting before sending to the model. Also filters out empty posts and limits total number of posts to analyze.
 */
function formatComments(posts: Array<{ content: string | null }>) {
    const limited = posts.slice(0, MAX_POSTS);
    return limited
        .map((p) => (p.content || "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS_PER_POST))
        .filter((content) => content.length > 0) // remove empty posts
        .map((content, idx) => `#${idx + 1}: ${content}`) // prefix with #1:, #2:, etc. for better readability by the model
        .join("\n"); // separate by new line
}

/**
 * Call the inference API with a prompt to analyze sentiment of the given posts. The model is instructed
 * to return a JSON object with a 0-100 score, which is then normalized and mapped to
 * negative/neutral/positive labels.
 *
 * @return Object { sentiment: "positive" | "negative" | "neutral", score: number 0 to 100 }
 * 
 */
async function callSentimentModel({ subject, posts }: { subject: string; posts: Array<{ content: string | null }> }) {
    if (!posts || posts.length === 0) {
        return { sentiment: "neutral", score: 50 };
    }

    const commentsBlock = formatComments(posts);

    const systemPrompt = [
        "You are a sports discussion sentiment analyst.",
        "Given a list of fan comments, return a compact JSON object strictly in this form:",
        '{"score":number_between_0_and_100}',
        "Do not add code fences or extra text.",
        "Scoring rubric:",
        "0-34 = negative overall mood.",
        "35-64 = neutral/balanced overall mood.",
        "65-100 = positive overall mood.",
        "Use the full range and pick a value that represents both direction and strength.",
        "Base the score on aggregate tone across all comments, not one outlier.",
    ].join(" ");

    const userPrompt = [
        `Subject: ${subject}`,
        "Comments:",
        commentsBlock,
        "Return only the JSON object.",
    ].join("\n\n");

    console.log("Sending prompt to model. total chars:", userPrompt.length);

    const res = await client.chatCompletion({
        model: HF_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
    });

    const raw = res?.choices?.[0]?.message?.content || "";
    const cleaned = raw.trim().replace(/^```json\s*|```$/g, ""); // remove ``` blocks if present

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err) {
        // try to extract via regex
        const match = cleaned.match(/\{[^}]*score[^}]*\}/i);
        if (match) {
            try {
                parsed = JSON.parse(match[0]);
            } catch (e) {
                parsed = null;
            }
        }
    }

    if (!parsed) {
        return { sentiment: "neutral", score: 50 };
    }

    const normalized = normalizeSentimentRecord({ score: parsed.score });
    return normalized;
}



/**
 * 
 * 
 */
export async function computeThreadSentiment(threadId: number | string) {
    const thread = await prisma.forumThread.findUnique({
        where: { id: Number(threadId) },
        include: { match: { include: { homeTeam: true, awayTeam: true } }, team: true },
    });

    if (!thread) {
        throw new Error("Thread not found");
    }

    console.log(`Computing sentiment for thread ${threadId} with match ${thread.matchId}`);

    const posts = await prisma.post.findMany({
        where: { threadId: Number(threadId), isHidden: false },
        include: { author: true },
        orderBy: { createdAt: "desc" },
        take: MAX_POSTS,
    });

    const overall = await callSentimentModel({ subject: "Overall thread mood", posts });

    let homeTeamResult = null;
    let awayTeamResult = null;

    // If it's a match thread, compute separate sentiment for home and away fans.
    if (thread.match) {
        const match = thread.match;
        const homePosts = posts.filter((p) => p.author?.favoriteTeamId === match.homeTeamId);
        const awayPosts = posts.filter((p) => p.author?.favoriteTeamId === match.awayTeamId);

        const homeLabel = match.homeTeam?.name || `team ${match.homeTeamId}`;
        const awayLabel = match.awayTeam?.name || `team ${match.awayTeamId}`;

        homeTeamResult = await callSentimentModel({ subject: `Fans of ${homeLabel}`, posts: homePosts });
        homeTeamResult = { ...homeTeamResult, teamId: match.homeTeamId };

        awayTeamResult = await callSentimentModel({ subject: `Fans of ${awayLabel}`, posts: awayPosts });
        awayTeamResult = { ...awayTeamResult, teamId: match.awayTeamId };
    }

    const now = new Date();
    const summaries = [];

    const overallRecord = await prisma.sentimentSummary.upsert({
        where: {
            threadId_targetKey: {
                threadId: Number(threadId),
                targetKey: "overall"
            },
        },
        update: {
            sentiment: overall.sentiment,
            score: overall.score,
            scope: "overall",
            computedAt: now,
            matchId: thread.matchId || null,
            teamId: null,
        },
        create: {
            threadId: Number(threadId),
            matchId: thread.matchId || null,
            teamId: null,
            scope: "overall",
            targetKey: "overall",
            sentiment: overall.sentiment,
            score: overall.score,
            computedAt: now,
        },
    });
    summaries.push(overallRecord);

    if (homeTeamResult) {
        const record = await prisma.sentimentSummary.upsert({
            where: {
                threadId_targetKey: {
                    threadId: Number(threadId),
                    targetKey: `team:${homeTeamResult.teamId}`,
                },
            },
            update: {
                sentiment: homeTeamResult.sentiment,
                score: homeTeamResult.score,
                scope: "team",
                computedAt: now,
                matchId: thread.matchId || null,
                teamId: homeTeamResult.teamId,
            },
            create: {
                threadId: Number(threadId),
                matchId: thread.matchId || null,
                teamId: homeTeamResult.teamId,
                scope: "team",
                targetKey: `team:${homeTeamResult.teamId}`,
                sentiment: homeTeamResult.sentiment,
                score: homeTeamResult.score,
                computedAt: now,
            },
        });
        summaries.push(record);
    }

    if (awayTeamResult) {
        const record = await prisma.sentimentSummary.upsert({
            where: {
                threadId_targetKey: {
                    threadId: Number(threadId),
                    targetKey: `team:${awayTeamResult.teamId}`,
                },
            },
            update: {
                sentiment: awayTeamResult.sentiment,
                score: awayTeamResult.score,
                scope: "team",
                computedAt: now,
                matchId: thread.matchId || null,
                teamId: awayTeamResult.teamId,
            },
            create: {
                threadId: Number(threadId),
                matchId: thread.matchId || null,
                teamId: awayTeamResult.teamId,
                scope: "team",
                targetKey: `team:${awayTeamResult.teamId}`,
                sentiment: awayTeamResult.sentiment,
                score: awayTeamResult.score,
                computedAt: now,
            },
        });
        summaries.push(record);
    }

    return {
        thread,
        summaries,
        computedAt: now,
    };
}

