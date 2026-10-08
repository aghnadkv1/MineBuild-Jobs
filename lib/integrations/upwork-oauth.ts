import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { externalIntegrationTokens } from "@/lib/db/schema";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

const stateCookieName = "minebuild_upwork_oauth";
const stateCookieLifetimeSeconds = 600;
let refreshInFlight: Promise<string> | null = null;

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ApiError(503, "UPWORK_NOT_CONFIGURED", `${name} belum dikonfigurasi di environment server.`);
  }
  return value;
}

export function getUpworkOAuthConfiguration() {
  const clientId = requiredEnvironment("UPWORK_CLIENT_ID");
  const clientSecret = requiredEnvironment("UPWORK_CLIENT_SECRET");
  const redirectUri = requiredEnvironment("UPWORK_REDIRECT_URI");
  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(redirectUri);
  } catch {
    throw new ApiError(503, "UPWORK_INVALID_REDIRECT_URI", "UPWORK_REDIRECT_URI bukan URL yang valid.");
  }
  if (
    parsedRedirect.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && parsedRedirect.hostname === "localhost")
  ) {
    throw new ApiError(503, "UPWORK_INVALID_REDIRECT_URI", "UPWORK_REDIRECT_URI harus menggunakan HTTPS di luar localhost.");
  }
  return { clientId, clientSecret, redirectUri };
}

function encryptionKey() {
  const secret = requiredEnvironment("BETTER_AUTH_SECRET");
  if (secret.length < 32) {
    throw new ApiError(503, "TOKEN_ENCRYPTION_UNAVAILABLE", "BETTER_AUTH_SECRET terlalu pendek untuk mengenkripsi token integrasi.");
  }
  return createHash("sha256").update(`minebuild:upwork-token:${secret}`).digest();
}

function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new ApiError(503, "UPWORK_TOKEN_INVALID", "Token Upwork tersimpan dalam format yang tidak valid. Hubungkan ulang akun Upwork.");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ApiError(503, "UPWORK_TOKEN_INVALID", "Token Upwork tidak dapat didekripsi. Hubungkan ulang akun Upwork.");
  }
}

function stateSignature(payload: string) {
  return createHmac("sha256", requiredEnvironment("BETTER_AUTH_SECRET"))
    .update(payload)
    .digest("base64url");
}

export function createUpworkOAuthState() {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${state}.${verifier}.${issuedAt}`;
  return {
    state,
    verifier,
    challenge,
    cookieName: stateCookieName,
    cookieValue: `${payload}.${stateSignature(payload)}`,
    cookieMaxAge: stateCookieLifetimeSeconds,
  };
}

export function verifyUpworkOAuthState(cookieValue: string | undefined, returnedState: string | null) {
  if (!cookieValue || !returnedState) {
    throw new ApiError(400, "UPWORK_OAUTH_STATE_INVALID", "Validasi OAuth Upwork gagal. Mulai proses koneksi ulang.");
  }
  const parts = cookieValue.split(".");
  if (parts.length !== 4) {
    throw new ApiError(400, "UPWORK_OAUTH_STATE_INVALID", "State OAuth Upwork tidak valid. Mulai proses koneksi ulang.");
  }
  const [state, verifier, issuedAtText, signature] = parts;
  const payload = `${state}.${verifier}.${issuedAtText}`;
  const expected = Buffer.from(stateSignature(payload));
  const received = Buffer.from(signature);
  const issuedAt = Number(issuedAtText);
  if (
    !state ||
    !verifier ||
    !Number.isSafeInteger(issuedAt) ||
    Date.now() / 1000 - issuedAt > stateCookieLifetimeSeconds ||
    issuedAt > Date.now() / 1000 ||
    expected.length !== received.length ||
    !timingSafeEqual(expected, received) ||
    state !== returnedState
  ) {
    throw new ApiError(400, "UPWORK_OAUTH_STATE_INVALID", "State OAuth Upwork tidak valid atau sudah kedaluwarsa. Mulai proses koneksi ulang.");
  }
  return verifier;
}

export function getUpworkStateCookieName() {
  return stateCookieName;
}

async function requestTokens(body: URLSearchParams) {
  const response = await fetch("https://www.upwork.com/api/v3/oauth2/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new ApiError(502, "UPWORK_TOKEN_REQUEST_FAILED", `Permintaan token Upwork gagal (HTTP ${response.status}).`);
  }
  const tokenPayload = tokenResponseSchema.safeParse(await response.json());
  if (!tokenPayload.success) {
    throw new ApiError(502, "UPWORK_TOKEN_RESPONSE_INVALID", "Respons token Upwork tidak lengkap atau tidak valid.");
  }
  return tokenPayload.data;
}

async function saveTokens(tokens: z.infer<typeof tokenResponseSchema>) {
  await getDb()
    .insert(externalIntegrationTokens)
    .values({
      provider: "upwork",
      accessTokenEncrypted: encryptToken(tokens.access_token),
      refreshTokenEncrypted: encryptToken(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: externalIntegrationTokens.provider,
      set: {
        accessTokenEncrypted: encryptToken(tokens.access_token),
        refreshTokenEncrypted: encryptToken(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        updatedAt: new Date(),
      },
    });
}

export async function exchangeUpworkAuthorizationCode(code: string, verifier: string) {
  const config = getUpworkOAuthConfiguration();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  const tokens = await requestTokens(body);
  await saveTokens(tokens);
}

async function refreshUpworkAccessToken() {
  const config = getUpworkOAuthConfiguration();
  const [stored] = await getDb()
    .select()
    .from(externalIntegrationTokens)
    .where(eq(externalIntegrationTokens.provider, "upwork"))
    .limit(1);
  if (!stored) {
    throw new ApiError(409, "UPWORK_NOT_CONNECTED", "Hubungkan akun Upwork sebelum menyinkronkan lowongan.");
  }
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: decryptToken(stored.refreshTokenEncrypted),
    grant_type: "refresh_token",
  });
  const tokens = await requestTokens(body);
  await saveTokens(tokens);
  return tokens.access_token;
}

export async function getUpworkAccessToken(forceRefresh = false) {
  const [stored] = await getDb()
    .select()
    .from(externalIntegrationTokens)
    .where(eq(externalIntegrationTokens.provider, "upwork"))
    .limit(1);
  if (!stored) {
    throw new ApiError(409, "UPWORK_NOT_CONNECTED", "Hubungkan akun Upwork sebelum menyinkronkan lowongan.");
  }
  if (!forceRefresh && stored.expiresAt.getTime() > Date.now() + 60_000) {
    return decryptToken(stored.accessTokenEncrypted);
  }
  if (!refreshInFlight) {
    refreshInFlight = refreshUpworkAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
