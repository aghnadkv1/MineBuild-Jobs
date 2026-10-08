import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, ApiError, requireRole } from "@/lib/api";
import {
  exchangeUpworkAuthorizationCode,
  getUpworkOAuthConfiguration,
  getUpworkStateCookieName,
  verifyUpworkOAuthState,
} from "@/lib/integrations/upwork-oauth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cookieName = getUpworkStateCookieName();
  try {
    await requireRole(request, ["admin"]);
    const { redirectUri } = getUpworkOAuthConfiguration();
    const query = request.nextUrl.searchParams;
    const code = query.get("code");
    if (query.has("error")) {
      throw new ApiError(400, "UPWORK_AUTHORIZATION_DENIED", "Otorisasi Upwork ditolak atau tidak dapat diselesaikan.");
    }
    if (!code || code.length > 2048) {
      throw new ApiError(400, "UPWORK_AUTHORIZATION_CODE_INVALID", "Upwork tidak mengembalikan kode otorisasi yang valid.");
    }
    const verifier = verifyUpworkOAuthState(
      request.cookies.get(cookieName)?.value,
      query.get("state"),
    );
    await exchangeUpworkAuthorizationCode(code, verifier);

    const response = NextResponse.redirect(new URL("/?upwork=connected", redirectUri));
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/integrations/upwork",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const response = apiErrorResponse(error);
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/integrations/upwork",
      maxAge: 0,
    });
    return response;
  }
}
