import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/server/auth";

// The link in the sign-in email lands here (SCR-01).
// Supabase's default email sends ?code=… (the browser that asked for the email holds the matching key).
// A custom email template can send ?token_hash=…&type=… instead. Both are accepted.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const code = q.get("code");
  const tokenHash = q.get("token_hash");
  const supabase = await supabaseServer();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: (q.get("type") ?? "email") as EmailOtpType })
      : { error: new Error("no code") };
  const to = request.nextUrl.clone();
  to.search = "";
  to.pathname = error ? "/login" : "/dashboard";
  if (error) to.searchParams.set("link", "failed");
  return NextResponse.redirect(to);
}
