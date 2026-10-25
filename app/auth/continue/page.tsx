
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import {
  getAuthenticatedAccount,
  homeForRole,
} from "@/lib/auth/roles";

/**
 * ACELINGUA V2
 * Phase 2 — Authentication Redirect
 *
 * Verifies the authenticated user at request time
 * and redirects according to the user's database role.
 */
async function ContinueAuthentication(): Promise<ReactNode> {
  // IMPORTANT:
  // Tell Next.js 16 to execute the following authentication
  // work during an actual request, not during prerendering.
  await connection();

  // Verify the current user and their Supabase profile.
  const account = await getAuthenticatedAccount();

  // No valid session: send the visitor to login.
  if (!account) {
    redirect("/login");
  }

  // Read the role from the verified database profile.
  // Administrator -> /admin
  // Learner       -> /dashboard
  redirect(homeForRole(account.role));
}

/**
 * Static loading UI for the Suspense boundary.
 */
function AuthenticationLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] px-6">
      <div className="w-full max-w-sm rounded-3xl border border-white bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-[#3558AE]/20 border-t-[#3558AE]" />

        <h1 className="text-xl font-bold text-[#2A255C]">
          Preparing your adventure...
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Verifying your ACELINGUA account and preparing
          your dashboard.
        </p>
      </div>
    </main>
  );
}

/**
 * Suspense allows the authentication check to
 * run dynamically while displaying a loading UI.
 */
export default function ContinuePage() {
  return (
    <Suspense fallback={<AuthenticationLoading />}>
      <ContinueAuthentication />
    </Suspense>
  );
}
