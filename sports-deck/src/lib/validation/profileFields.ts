export const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 30;
export const DISPLAYNAME_MAX_LENGTH = 100;

export function isValidUsername(username: string): boolean {
  if (username == null || typeof username !== "string") return false;
  const t = username.trim();
  return t.length >= USERNAME_MIN_LENGTH && t.length <= USERNAME_MAX_LENGTH && USERNAME_REGEX.test(t);
}

export function usernameClientError(value: string): string | null {
  const t = value.trim();
  if (t.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  }
  if (t.length > USERNAME_MAX_LENGTH) {
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters`;
  }
  if (!USERNAME_REGEX.test(t)) {
    return "Only letters, numbers, underscores, and hyphens are allowed";
  }
  return null;
}

export function displayNameClientError(value: string): string | null {
  const t = value.trim();
  if (t.length > DISPLAYNAME_MAX_LENGTH) {
    return `Display name must be at most ${DISPLAYNAME_MAX_LENGTH} characters`;
  }
  return null;
}
