"use client";
import Link from "next/link";
export default function AdminError({ retry }: {
  error: unknown;
  retry: () => void;
}) {
  return <main className="rounded-2xl border border-rose-200 bg-white p-6 text-[#2A255C]">
    <h1 className="text-2xl font-bold">Unable to load this workspace</h1>
    <p role="alert" className="mt-3 text-sm text-slate-600">The selected lesson may be unavailable, or the data could not be loaded. Retry or choose a lesson from Curriculum Studio.</p>
    <div className="mt-5 flex flex-wrap gap-3">
      <button onClick={retry} className="rounded-xl bg-[#3558AE] px-4 py-3 font-semibold text-white">Try again</button>
      <Link href="/admin/curriculum" className="rounded-xl border border-[#C7A9D4] px-4 py-3 font-semibold">Open Curriculum Studio</Link>
    </div>
  </main>;
}
