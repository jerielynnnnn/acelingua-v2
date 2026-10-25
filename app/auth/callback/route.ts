
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

function allowedDestination(value: string | null): string {
  if (value === "/reset-password") {
    return "/reset-password";
  }

  return "/auth/continue";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  const destination = allowedDestination(
    url.searchParams.get("next")
  );

  const supabase = await createClient();

  // PKCE confirmation flow.
  if (code) {
    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(
        new URL(destination, url.origin)
      );
    }
  }

  // Token-hash confirmation flow, for customized
  // Supabase email templates.
  if (
    tokenHash &&
    (type === "email" ||
      type === "signup" ||
      type === "recovery" ||
      type === "invite" ||
      type === "magiclink" ||
      type === "email_change")
  ) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (!error) {
      const next =
        type === "recovery"
          ? "/reset-password"
          : destination;

      return NextResponse.redirect(
        new URL(next, url.origin)
      );
    }
  }

  const failure = new URL("/login", url.origin);
  failure.searchParams.set("error", "invalid_callback");

  return NextResponse.redirect(failure);
}
