import { NextResponse } from "next/server";
import { loadServerAdminConfig } from "@/lib/adminConfigStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await loadServerAdminConfig();
    const authP = config?.authProviders || {};

    const googleId = process.env.GOOGLE_CLIENT_ID || authP.googleClientId;
    const googleSecret = process.env.GOOGLE_CLIENT_SECRET || authP.googleClientSecret;

    const githubId = process.env.GITHUB_CLIENT_ID || authP.githubClientId;
    const githubSecret = process.env.GITHUB_CLIENT_SECRET || authP.githubClientSecret;

    const google = Boolean(googleId && googleSecret);
    const github = Boolean(githubId && githubSecret);

    return NextResponse.json({
      google,
      github,
      email: true,
    });
  } catch (err) {
    console.warn("Failed checking dynamic auth providers:", err);
    return NextResponse.json({
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      email: true,
    });
  }
}
