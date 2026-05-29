import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

/** Wspólne opcje ciasteczek wyzwania WebAuthn (prod: Secure + SameSite). */
export function passkeyChallengeCookieOptions(
  overrides?: Partial<ResponseCookie>,
): Partial<ResponseCookie> {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    maxAge: 60 * 5,
    path: "/",
    sameSite: "lax",
    secure: isProd,
    ...overrides,
  };
}
