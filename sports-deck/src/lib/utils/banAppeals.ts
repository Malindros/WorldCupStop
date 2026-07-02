export const APPEAL_COOLDOWN_DAYS = 7;
export const APPEAL_COOLDOWN_MS = APPEAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export function getNextAppealAllowedAt(lastAppealSubmittedAt: Date) {
  return new Date(lastAppealSubmittedAt.getTime() + APPEAL_COOLDOWN_MS);
}

export function isAppealCooldownActive(lastAppealSubmittedAt: Date, now = new Date()) {
  return getNextAppealAllowedAt(lastAppealSubmittedAt).getTime() > now.getTime();
}