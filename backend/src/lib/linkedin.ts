// "Sign in with LinkedIn" (OpenID Connect, scopes: openid profile email).
// LinkedIn has no API to look a person up by email, and third-party "email to profile" services scrape
// LinkedIn against its terms, so identity comes only from the member signing in themselves.
export interface LinkedInUserInfo {
  sub: string;
  name: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
}

// Where LinkedIn may send the member back to. Each must also be listed in the LinkedIn app's Auth settings.
export function linkedinRedirectUris(): string[] {
  const web = process.env.WEB_URL?.replace(/\/$/, "");
  return [...(web ? [`${web}/connect/linkedin/callback`] : []), "http://localhost:5173/connect/linkedin/callback"];
}

export function authorizeUrl(redirectUri: string, state: string): string {
  if (!process.env.LINKEDIN_CLIENT_ID) throw new Error("linkedin_not_configured");
  if (!linkedinRedirectUris().includes(redirectUri)) throw new Error("linkedin_redirect_not_allowed");
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email",
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${p}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<LinkedInUserInfo> {
  const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET } = process.env;
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) throw new Error("linkedin_not_configured");
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) throw new Error("linkedin_exchange_failed");
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const infoRes = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!infoRes.ok) throw new Error("linkedin_userinfo_failed");
  return (await infoRes.json()) as LinkedInUserInfo; // access token is discarded here; we don't keep it
}
