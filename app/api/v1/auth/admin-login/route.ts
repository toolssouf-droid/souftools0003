/**
 * Admin Instant Direct Authentication Route
 * Allows authorized administrators to log in using their Master Security Key,
 * persisting a cryptographically verified session in Turso.
 */

import { NextRequest, NextResponse } from "next/server";
import { isUserAdmin, verifyAdminMasterPassword } from "@/lib/auth/adminRoles";
import { UserRepository } from "@/lib/db";
import {
  attachVerifiedSessionCookies,
  createVerifiedServerSession,
} from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required", code: "INVALID_CREDENTIALS" },
        { status: 400 }
      );
    }

    const isAdmin = isUserAdmin(email);
    const isMasterPasswordValid = verifyAdminMasterPassword(password);

    if (!isAdmin || !isMasterPasswordValid) {
      return NextResponse.json(
        { error: "Unauthorized admin credentials", code: "UNAUTHORIZED_ADMIN" },
        { status: 401 }
      );
    }

    const userId = `admin_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const dbUser = await UserRepository.upsertUser({
      id: userId,
      email,
      displayName: email.split("@")[0],
      role: "super_admin",
    });

    const session = await createVerifiedServerSession({
      req,
      userId: dbUser.id,
      email: dbUser.email,
      role: "super_admin",
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: "super_admin",
      },
    });

    attachVerifiedSessionCookies(response, {
      req,
      signedCookie: session.signedCookie,
      userId: dbUser.id,
      email: dbUser.email,
      role: "super_admin",
    });

    return response;
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "Internal server error during admin authentication" },
      { status: 500 }
    );
  }
}
