export const REPORT_REASON_CODES = [
    "SPAM",
    "HARASSMENT",
    "HATE_SPEECH",
    "VIOLENCE",
    "SEXUAL_CONTENT",
    "MISINFORMATION",
    "OTHER",
] as const;

export const SYSTEM_REPORT_REASON_CODE = "SYSTEM_FLAGGED" as const;

export type UserReportReasonCode = (typeof REPORT_REASON_CODES)[number];
export type ReportReasonCode = UserReportReasonCode | typeof SYSTEM_REPORT_REASON_CODE;

export const REPORT_REASON_OPTIONS: Array<{ code: UserReportReasonCode; label: string; description: string }> = [
    { code: "SPAM", label: "Spam", description: "Promotional content, scams, or repetitive unwanted posts." },
    { code: "HARASSMENT", label: "Harassment", description: "Bullying, insults, or targeted abuse toward someone." },
    { code: "HATE_SPEECH", label: "Hate speech", description: "Attacks based on identity or protected characteristics." },
    { code: "VIOLENCE", label: "Violence", description: "Threats, encouragement of harm, or graphic violent content." },
    { code: "SEXUAL_CONTENT", label: "Sexual content", description: "Explicit sexual or adult content that is inappropriate here." },
    { code: "MISINFORMATION", label: "Misinformation", description: "False or misleading claims presented as facts." },
    { code: "OTHER", label: "Other", description: "Another policy concern not covered above." },
];

const REASON_LABEL_MAP: Record<ReportReasonCode, string> = {
    SPAM: "Spam",
    HARASSMENT: "Harassment",
    HATE_SPEECH: "Hate speech",
    VIOLENCE: "Violence",
    SEXUAL_CONTENT: "Sexual content",
    MISINFORMATION: "Misinformation",
    OTHER: "Other",
    SYSTEM_FLAGGED: "System flagged",
};

export function isUserReportReasonCode(value: unknown): value is UserReportReasonCode {
    return typeof value === "string" && REPORT_REASON_CODES.includes(value as UserReportReasonCode);
}

export function normalizeAdditionalComment(value: unknown, maxLength = 500): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
}

export function composeReportReason(reasonCode: ReportReasonCode, additionalComment?: string | null): string {
    const label = REASON_LABEL_MAP[reasonCode] || "Other";
    if (!additionalComment) return label;
    return `${label}: ${additionalComment}`.slice(0, 500);
}