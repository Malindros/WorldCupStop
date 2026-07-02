/**
 * Validates that the provided id parameter is a valid number.
 * Ids should be positive integers.
 * @return the numeric id if valid, or null if invalid
 */
function verifyIdParam(id: unknown): number | null {
    const num = Number(id);
    return Number.isInteger(num) && num > 0 ? num : null;
}

function sanitizeText(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.trim();
}

type SlugifyOptions = {
    maxLength?: number;
};

/**
 * Convert a string into a slug by lowercasing, replacing spaces with dashes,
 * and removing non-alphanumeric characters (except dashes).
 */
function slugify(value: unknown, options: SlugifyOptions = {}): string {
    const { maxLength } = options;
    const name = sanitizeText(value);
    if (!name) return "";

    const slug = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    if (!slug) return "";
    if (typeof maxLength === "number" && maxLength > 0) {
        return slug.slice(0, maxLength);
    }
    return slug;
}

function normalizeTags(value: unknown): Array<{ name: string; slug: string }> | null {
    if (!Array.isArray(value)) return null;

    const seen = new Set<string>();
    const normalized: Array<{ name: string; slug: string }> = [];

    for (const item of value) {
        if (typeof item !== "string") continue;
        const name = sanitizeText(item);
        if (!name) continue;

        const slug = slugify(name);
        if (!slug || seen.has(slug)) continue;

        seen.add(slug);
        normalized.push({ name, slug });
    }

    return normalized;
}

export { verifyIdParam, sanitizeText, slugify, normalizeTags };
