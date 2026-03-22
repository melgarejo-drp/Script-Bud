import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth is temporarily disabled.
// To re-enable, replace this with next-auth withAuth middleware
// and configure valid Google OAuth credentials in Google Cloud Console:
// https://console.cloud.google.com → APIs & Services → Credentials
// Authorized redirect URI: https://script-bud.vercel.app/api/auth/callback/google
export default function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
