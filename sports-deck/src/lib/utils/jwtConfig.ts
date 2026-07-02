/**
 * JWT signing secrets must come from the environment — never commit real values.
 * Cookie max-age values match token lifetimes (seconds).
 */

export const JWT_ACCESS_MAX_AGE_SEC = 15 * 60;
export const JWT_REFRESH_MAX_AGE_SEC = 60 * 60;

let cachedAccessSecret: string | undefined;
let cachedRefreshSecret: string | undefined;

function readRequiredEnv(name: "JWT_SECRET" | "JWT_REFRESH_SECRET"): string {
  const value = process.env[name];
  if (value == null || String(value).trim() === "") {
    throw new Error(
      `${name} is not set. Add it to your environment (e.g. .env). Generate with: openssl rand -base64 32`,
    );
  }
  return String(value);
}

export function getJwtSecret(): string {
  if (cachedAccessSecret === undefined) {
    cachedAccessSecret = readRequiredEnv("JWT_SECRET");
  }
  return cachedAccessSecret;
}

export function getJwtRefreshSecret(): string {
  if (cachedRefreshSecret === undefined) {
    cachedRefreshSecret = readRequiredEnv("JWT_REFRESH_SECRET");
  }
  return cachedRefreshSecret;
}
