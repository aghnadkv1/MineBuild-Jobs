"use client";

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | (ApiErrorPayload & T)
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ??
        `Permintaan gagal (${response.status} ${response.statusText}).`,
    );
  }
  if (!payload) throw new Error("Server mengembalikan respons yang tidak valid.");
  return payload;
}
