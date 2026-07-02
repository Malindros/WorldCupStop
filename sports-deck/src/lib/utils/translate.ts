import { client, HF_MODEL } from "@/lib/inference";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export function hashText(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * Translate the given text to English using a Hugging Face model.
 * If the text has been translated before and its hash is in the cache, return the cached translation instead of calling the model again.
 * Otherwise call the model, store the result in the cache, and return the translation.
 *
 * Written with help from ChatGPT.
 */
export async function translateToEnglish(text: string, sourceLanguage: string | null = null): Promise<{ translatedText: string; cached: boolean }> {
    const targetLanguage = "en";
    const hash = hashText(text + "|" + (sourceLanguage || "auto") + "|" + targetLanguage);

    // check cache so we don't call model unnecessarily
    const cached = await prisma.translationCache.findUnique({ where: { originalTextHash: hash } }).catch(() => null);
    if (cached) {
        return { translatedText: cached.translatedText, cached: true };
    }

    const systemPrompt = `You are a helpful translator. Translate the provided text into English. If the source language is unknown, try to detect it and translate accordingly. IMPORTANT: Respond with only the translated text - do not add any explanations, formatting, commentary, or extra characters. If the text is already in English, simply return it without modification. Do not add quotes around the translation.`;
    const userPrompt = `Source language: ${sourceLanguage || "unknown"}\n\nText:\n""" ${text} """`;

    console.log("Translating text with prompt:", { systemPrompt, userPrompt });

    const res = await client.chatCompletion({
        model: HF_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
    });

    const translated = res?.choices?.[0]?.message?.content || "";

    // post-process to remove extra wrapping quotes if the model added them
    const cleaned = translated.trim();
    const finalOutput = (cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("“") && cleaned.endsWith("”"))
        ? cleaned.slice(1, -1)
        : cleaned;

    // store in cache
    try {
        await prisma.translationCache.create({
            data: {
                originalTextHash: hash,
                sourceLanguage: sourceLanguage,
                targetLanguage: targetLanguage,
                translatedText: finalOutput,
            },
        });
    } catch (e) {
        console.error("Failed to cache translation", e);
    }

    return { translatedText: finalOutput, cached: false };
}

export default translateToEnglish;
