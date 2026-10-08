import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { ServerConfigurationError } from "@/lib/errors";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requireUser(request: Request) {
  let session;
  try {
    session = await getAuth().api.getSession({ headers: request.headers });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("BETTER_AUTH_SECRET") ||
        error.message.includes("DATABASE_URL"))
    ) {
      throw new ApiError(503, "SERVER_NOT_CONFIGURED", "Autentikasi atau database belum dikonfigurasi.");
    }
    throw error;
  }
  if (!session) {
    throw new ApiError(401, "UNAUTHENTICATED", "Silakan masuk untuk melanjutkan.");
  }
  return session.user;
}

export async function requireRole(
  request: Request,
  allowedRoles: readonly string[],
) {
  const currentUser = await requireUser(request);
  if (typeof currentUser.role !== "string" || !allowedRoles.includes(currentUser.role)) {
    throw new ApiError(403, "FORBIDDEN", "Akun Anda tidak memiliki izin untuk tindakan ini.");
  }
  return currentUser;
}

export function requireUuid(value: string, name = "ID") {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new ApiError(400, "INVALID_ID", `${name} tidak valid.`);
  }
  return value;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Body harus berupa JSON yang valid.");
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof ServerConfigurationError) {
    return NextResponse.json(
      { error: { code: "SERVER_NOT_CONFIGURED", message: "Database atau autentikasi belum dikonfigurasi." } },
      { status: 503 },
    );
  }

  if (error instanceof Error && error.name === "ZodError") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Data request tidak valid." } },
      { status: 400 },
    );
  }

  const databaseCode =
    error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
  if (databaseCode === "23505") {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "Data yang sama sudah tersimpan." } },
      { status: 409 },
    );
  }

  if (
    error instanceof Error &&
    (error.name === "PostgresError" ||
      (databaseCode !== undefined &&
        (databaseCode.startsWith("08") ||
          ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND"].includes(databaseCode))))
  ) {
    return NextResponse.json(
      { error: { code: "DATABASE_UNAVAILABLE", message: "Database sedang tidak tersedia." } },
      { status: 503 },
    );
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan server." } },
    { status: 500 },
  );
}

export function pagination(searchParams: URLSearchParams) {
  const rawLimit = Number(searchParams.get("limit") ?? 20);
  const rawOffset = Number(searchParams.get("offset") ?? 0);
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;
  const offset = Number.isInteger(rawOffset) ? Math.max(rawOffset, 0) : 0;
  return { limit, offset };
}
