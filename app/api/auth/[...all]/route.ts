import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";

async function handler(request: Request) {
  try {
    return await getAuth().handler(request);
  } catch (error) {
    console.error("Authentication service error:", error);
    return Response.json(
      { error: { code: "AUTH_UNAVAILABLE", message: "Layanan autentikasi belum siap. Periksa konfigurasi server." } },
      { status: 503 },
    );
  }
}

export { handler as GET, handler as POST };
