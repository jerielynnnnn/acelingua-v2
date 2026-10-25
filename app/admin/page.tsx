import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function AdminLoading() {
  return (
    <main className="min-h-screen bg-slate-50 p-10">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="h-10 w-64 rounded-xl bg-slate-200" />
        <div className="mt-6 h-32 rounded-2xl bg-slate-200" />
      </div>
    </main>
  );
}

async function AdminContent() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 p-10">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">
            ACELINGUA Administration
          </h1>

          <p className="mt-4 text-slate-600">
            You must sign in to access the Admin Portal.
          </p>

          <Link href="/" className="mt-6 inline-block text-indigo-600">
            Return Home
          </Link>
        </div>
      </main>
    );
  }

  // Phase 1: Deny access until administrator roles
  // and authorization are implemented in Phase 2.
  return (
    <main className="min-h-screen bg-slate-50 p-10">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">
          Admin Access Restricted
        </h1>

        <p className="mt-4 text-slate-600">
          Administrator verification has not been enabled yet.
          This portal will be secured with database roles and
          server-side authorization in Phase 2.
        </p>

        <Link href="/" className="mt-6 inline-block text-indigo-600">
          Return Home
        </Link>
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminContent />
    </Suspense>
  );
}