
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import ProfileEditor from "@/components/profile/ProfileEditor";

import {
  homeForRole,
  requireAccount,
} from "@/lib/auth/roles";

/**
 * ACELINGUA V2
 * Phase 2 — Protected User Profile
 *
 * Authentication is performed at request time
 * to prevent Next.js 16 prerendering errors.
 */
async function ProfileContent() {
  // Wait for an actual HTTP request before
  // checking Supabase authentication.
  await connection();

  // Any verified Admin or Learner can access
  // their own profile.
  const account = await requireAccount();

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 text-[#2A255C]">
      <div className="mx-auto max-w-2xl">
        <Link
          href={homeForRole(account.role)}
          className="text-sm font-semibold text-[#3558AE] transition hover:underline"
        >
          ← Back to Dashboard
        </Link>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8">
            <p className="text-sm font-bold text-[#3558AE]">
              ACELINGUA V2
            </p>

            <h1 className="mt-3 text-3xl font-bold">
              My Profile
            </h1>

            <p className="mt-3 text-sm text-slate-500">
              Manage your ACELINGUA account information.
            </p>
          </div>

          <div className="mb-8 rounded-2xl border border-[#e7e3ff] bg-[#f5f3ff] p-5">
            <h2 className="mb-4 text-sm font-bold text-[#3558AE]">
              Account Information
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-slate-500">
                  Email Address
                </span>
                <span className="font-semibold break-all">
                  {account.email}
                </span>
              </div>

              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-slate-500">
                  Account Role
                </span>
                <span className="rounded-lg bg-white px-3 py-1 font-semibold capitalize text-[#3558AE]">
                  {account.role}
                </span>
              </div>
            </div>
          </div>

          <section>
            <h2 className="mb-5 text-xl font-bold">
              Edit Profile
            </h2>

            <ProfileEditor
              userId={account.id}
              initialDisplayName={account.displayName ?? ""}
              initialUsername={account.username ?? ""}
            />
          </section>

          <p className="mt-8 border-t border-slate-100 pt-5 text-xs leading-relaxed text-slate-500">
            Your account role is protected by Supabase
            authorization policies. You can update your
            display name and username, but you cannot
            change your own account permissions.
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * Loading interface displayed while Supabase
 * verifies the user session.
 */
function ProfileLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] px-6">
      <div
        role="status"
        className="w-full max-w-sm rounded-3xl border border-white bg-white p-8 text-center shadow-lg"
      >
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-[#3558AE]/20 border-t-[#3558AE]" />

        <h1 className="text-xl font-bold text-[#2A255C]">
          Loading your profile...
        </h1>

        <p className="mt-3 text-sm text-slate-500">
          Verifying your account and retrieving
          your profile information.
        </p>
      </div>
    </main>
  );
}

/**
 * Suspense provides a loading boundary while
 * the protected content renders at request time.
 */
export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfileContent />
    </Suspense>
  );
}
