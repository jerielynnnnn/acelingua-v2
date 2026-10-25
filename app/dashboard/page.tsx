import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function DashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-72 rounded-xl bg-slate-200" />
          <div className="h-5 w-96 max-w-full rounded-lg bg-slate-200" />
          <div className="h-48 rounded-2xl bg-slate-200" />
        </div>
      </div>
    </main>
  );
}

async function DashboardContent() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <span className="text-sm font-semibold text-indigo-600">
            ACELINGUA V2
          </span>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Welcome to your dashboard!
          </h1>

          <p className="mt-3 text-slate-600">
            Your learner account is authenticated successfully.
          </p>

          <div className="mt-8 rounded-2xl bg-indigo-50 p-6">
            <h2 className="text-xl font-semibold text-indigo-900">
              Learning System
            </h2>

            <p className="mt-2 text-indigo-700">
              Your courses, lessons, world exploration, and
              learning progress will be implemented in the
              next development phases.
            </p>
          </div>

          <Link
            href="/"
            className="mt-8 inline-block rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white transition hover:bg-indigo-700"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}