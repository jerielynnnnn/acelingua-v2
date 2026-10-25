
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";

import { requireAccount } from "@/lib/auth/roles";

type Props = {
  children: ReactNode;
};

async function AdminAccessGate({ children }: Props) {
  // Prevent Supabase session verification during prerendering.
  await connection();

  // Only verified administrators can access this portal.
  await requireAccount("admin");

  return <>{children}</>;
}

function AdminLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div
        role="status"
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg"
      >
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-[#3558AE]/20 border-t-[#3558AE]" />

        <h1 className="text-xl font-bold text-[#2A255C]">
          Verifying administrator access...
        </h1>

        <p className="mt-3 text-sm text-slate-500">
          Checking your ACELINGUA administrator permissions.
        </p>
      </div>
    </main>
  );
}

export default function AdminLayout({ children }: Props) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminAccessGate>{children}</AdminAccessGate>
    </Suspense>
  );
}
