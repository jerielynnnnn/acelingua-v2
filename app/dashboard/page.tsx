
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import {
  BookOpen,
  Compass,
  GraduationCap,
  Sparkles,
} from "lucide-react";

import { requireAccount } from "@/lib/auth/roles";
import { signOutAction } from "@/lib/auth/actions";

/**
 * ACELINGUA V2
 * Phase 2 — Protected Learner Dashboard
 *
 * Authentication must execute at request time.
 * This prevents Next.js 16 from prerendering
 * Supabase's time-dependent session verification.
 */
async function LearnerDashboardContent() {
  // Fix: Wait for an actual incoming request before
  // executing Supabase authentication.
  await connection();

  // Verify the user and require the learner role.
  // Unauthenticated users go to /login.
  // Admin users go to /admin.
  const account = await requireAccount("learner");

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] px-5 py-8 text-[#2A255C] md:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3558AE] text-white">
              <BookOpen />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                ACElingua
              </h1>

              <p className="text-xs text-slate-500">
                Learn. Speak. Explore.
              </p>
            </div>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-xl border border-white bg-white/80 px-5 py-3 font-semibold transition hover:bg-white"
            >
              Sign Out
            </button>
          </form>
        </header>

        <section className="mt-10 rounded-[30px] border border-white/80 bg-white/85 p-8 shadow-sm">
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0edff] text-[#3558AE]">
              <GraduationCap size={32} />
            </div>

            <div className="flex-1">
              <p className="text-sm font-bold text-[#3558AE]">
                YOUR LEARNING ADVENTURE
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                Hello, {account.displayName || "Explorer"}!
              </h2>

              <p className="mt-3 text-slate-500">
                Your learner account is authenticated and protected.
                Courses, lessons, and progress will be connected
                in the upcoming development phases.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#f5f3ff] p-5">
              <BookOpen className="text-[#3558AE]" />

              <h3 className="mt-4 font-bold">
                Learn
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Interactive language courses
              </p>
            </div>

            <div className="rounded-2xl bg-[#edf8ff] p-5">
              <Compass className="text-[#3558AE]" />

              <h3 className="mt-4 font-bold">
                Explore
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Travel through learning worlds
              </p>
            </div>

            <div className="rounded-2xl bg-[#fff1f6] p-5">
              <Sparkles className="text-[#B64074]" />

              <h3 className="mt-4 font-bold">
                Earn
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Unlock achievements and rewards
              </p>
            </div>
          </div>

          <Link
            href="/profile"
            className="mt-8 inline-block rounded-xl bg-[#3558AE] px-6 py-3 font-semibold text-white transition hover:bg-[#2A255C]"
          >
            My Profile
          </Link>
        </section>
      </div>
    </main>
  );
}

/**
 * Static loading screen displayed while the
 * authenticated dashboard is being rendered.
 */
function DashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] px-6">
      <div
        role="status"
        className="w-full max-w-sm rounded-3xl border border-white bg-white p-8 text-center shadow-lg"
      >
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-[#3558AE]/20 border-t-[#3558AE]" />

        <h1 className="text-xl font-bold text-[#2A255C]">
          Loading your adventure...
        </h1>

        <p className="mt-3 text-sm text-slate-500">
          Checking your learner account and preparing
          your dashboard.
        </p>
      </div>
    </main>
  );
}

/**
 * Suspense is required for request-time rendering
 * with Next.js 16 Cache Components.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <LearnerDashboardContent />
    </Suspense>
  );
}
