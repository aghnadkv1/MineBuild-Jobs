import { createUpworkOAuthState, getUpworkOAuthConfiguration } from "@/lib/integrations/upwork-oauth";
import { apiErrorResponse, requireRole } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireRole(request, ["admin"]);
    const config = getUpworkOAuthConfiguration();
    const oauthState = createUpworkOAuthState();
    const authorizationUrl = new URL("https://www.upwork.com/ab/account-security/oauth2/authorize");
    authorizationUrl.search = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state: oauthState.state,
      code_challenge: oauthState.challenge,
      code_challenge_method: "S256",
    }).toString();

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(oauthState.cookieName, oauthState.cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/integrations/upwork",
      maxAge: oauthState.cookieMaxAge,
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
