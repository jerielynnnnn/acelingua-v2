
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import {
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Users,
} from "lucide-react";

import { requireAccount } from "@/lib/auth/roles";
import { signOutAction } from "@/lib/auth/actions";

const modules = [
  {
    title: "Language Management",
    description: "Manage supported learning languages.",
    icon: BookOpen,
  },
  {
    title: "Course Management",
    description: "Build and publish learning content.",
    icon: GraduationCap,
  },
  {
    title: "User Management",
    description: "Manage learners and authorized staff.",
    icon: Users,
  },
];

async function AdminDashboardContent() {
  // Explicitly wait for an HTTP request.
  await connection();

  // Verify the current user against Supabase.
  const account = await requireAccount("admin");

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-[#2A255C] md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#3558AE]">
              ACELINGUA V2
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Admin Dashboard
            </h1>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-medium transition hover:bg-slate-100"
            >
              Sign Out
            </button>
          </form>
        </header>

        <section className="mt-8 rounded-3xl bg-gradient-to-r from-[#2A255C] to-[#3558AE] p-8 text-white">
          <ShieldCheck size={32} />

          <h2 className="mt-4 text-2xl font-bold">
            Welcome, {account.displayName || "Administrator"}!
          </h2>

          <p className="mt-3 text-sm text-white/80">
            Your administrator role has been verified by Supabase.
          </p>

          <p className="mt-2 text-xs text-white/70">
            Role: {account.role}
          </p>
        </section>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <div
                key={module.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0edff] text-[#3558AE]">
                  <Icon size={23} />
                </div>

                <h3 className="font-bold">
                  {module.title}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {module.description}
                </p>

                <p className="mt-5 text-xs font-semibold text-[#3558AE]">
                  Management tools coming in Phase 3+
                </p>
              </div>
            );
          })}
        </div>
        <Link href="/admin/curriculum">
  Open Curriculum Studio
</Link>

        <Link
          href="/profile"
          className="mt-8 inline-block rounded-xl bg-[#3558AE] px-6 py-3 font-semibold text-white transition hover:bg-[#2A255C]"
        >
          Manage My Profile
        </Link>
      </div>
    </main>
  );
}

function AdminDashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div
        role="status"
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg"
      >
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-[#3558AE]/20 border-t-[#3558AE]" />

        <h1 className="text-xl font-bold text-[#2A255C]">
          Loading Admin Dashboard...
        </h1>

        <p className="mt-3 text-sm text-slate-500">
          Preparing your management workspace.
        </p>
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminDashboardLoading />}>
      <AdminDashboardContent />
    </Suspense>
  );
}
