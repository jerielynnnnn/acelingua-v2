"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, ClipboardCheck, Gamepad2, Globe2, Layers3, LayoutDashboard, Menu, PencilLine, X } from "lucide-react";
import { lessonHref, routeTitle } from "@/lib/admin/navigation";
const navigation = [
  ["", "Curriculum Studio", BookOpen], ["builder", "Courses & Languages", Globe2],
  ["ai-course", "AI Course Creator", Globe2],
  ["roadmap", "Unit & Lesson Roadmap", Layers3], ["lesson-editor", "Lesson Content", PencilLine],
  ["activities", "Activities & Assessments", Gamepad2], ["review", "Review & Publishing", ClipboardCheck],
] as const;
export default function AdminShell({ children }: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const lesson = params.get("lesson");
  const slug = pathname.split("/")[3] ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open)
      drawer.current?.showModal();
    else if (drawer.current?.open) {
      drawer.current.close();
      trigger.current?.focus();
    }
  }, [open]);
  const title = pathname === "/admin" ? "Dashboard" : routeTitle(slug);
  const context = { course: params.get("course"), unit: params.get("unit") };
  const parent = ["publish", "approve"].includes(slug) ? lessonHref("review", lesson, context) : slug === "lesson-preview" ? lessonHref("lesson-editor", lesson, context) : lessonHref("", lesson, context);
  function links(compact = false) {
    const linkClass = (active: boolean) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${active ? "bg-[#3558AE] text-white" : "text-[#2A255C] hover:bg-[#eeeafd]"}`;
    return <nav aria-label="Admin navigation" className="space-y-2">
      <p className="px-3 py-2 text-xs font-bold text-slate-500">
        {compact ? "" : "GENERAL"}
      </p>
      <Link title="Dashboard" onClick={() => setOpen(false)} href="/admin" aria-current={pathname === "/admin" ? "page" : undefined} className={linkClass(pathname === "/admin")}>
        <LayoutDashboard size={20} className="shrink-0" />
        {!compact && "Dashboard"}
      </Link>
      <p className="px-3 pt-6 pb-2 text-xs font-bold text-slate-500">
        {compact ? "" : "CURRICULUM"}
      </p>
      {navigation.map(([target, label, Icon]) => {
        const active = pathname !== "/admin" && (target === slug || (target === "lesson-editor" && ["lesson-ai", "lesson-preview"].includes(slug)) || (target === "activities" && ["practice-ai", "assessment-ai"].includes(slug)) || (target === "review" && ["consistency", "approve", "publish"].includes(slug)));
        return <Link key={target} title={label} onClick={() => setOpen(false)} href={lessonHref(target, lesson, context)} aria-current={active ? "page" : undefined} className={linkClass(active)}>
          <Icon size={20} className="shrink-0" />
          {!compact && label}
        </Link>;
      })}
    </nav>;
  }
  return <div className="admin-shell min-h-screen text-[#2A255C]" style={{ background: "linear-gradient(124deg, #f9f2ff 0%, #e6f7ff 29%, #eeeafd 61%, #fff0e9 100%)" }}>
    <a href="#admin-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-4">Skip to content</a>
    <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-[#C7A9D4]/30 bg-white/90 p-4 lg:flex ${collapsed ? "w-20" : "w-64"}`}>
      <Link href="/admin" className="mb-6 px-2 py-3 font-extrabold tracking-wide" aria-label="ACELINGUA Admin">
        {collapsed ? "A" : "ACELINGUA ADMIN"}
      </Link>
      <div className="flex-1 overflow-y-auto">
        {links(collapsed)}
      </div>
      <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="mt-4 flex justify-center rounded-xl border border-[#C7A9D4]/40 p-3">
        {collapsed ? <ChevronRight /> : <ChevronLeft />}
      </button>
    </aside>
    <dialog ref={drawer} aria-label="Admin navigation" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-80 max-w-[90vw] bg-white p-5 backdrop:bg-[#2A255C]/40">
      <div className="mb-6 flex items-center justify-between">
        <span className="font-extrabold">ACELINGUA ADMIN</span>
        <button autoFocus onClick={() => setOpen(false)} aria-label="Close navigation" className="rounded-lg p-2">
          <X />
        </button>
      </div>
      {links()}
    </dialog>
    <div className={collapsed ? "lg:pl-20" : "lg:pl-64"}>
      <header className="flex items-center gap-4 border-b border-white/70 bg-white/70 px-5 py-4 lg:px-8">
        <button ref={trigger} onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} className="rounded-lg p-2 lg:hidden">
          <Menu />
        </button>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/admin" className="hover:underline">Admin</Link>
          {pathname !== "/admin" && <>
            <span aria-hidden="true">/</span>
            {slug ? <Link href={lessonHref("", lesson)} className="hover:underline">Curriculum Studio</Link> : <span aria-current="page">Curriculum Studio</span>}
          </>}{["approve", "publish"].includes(slug) && <>
            <span aria-hidden="true">/</span>
            <Link href={lessonHref("review", lesson)}>Curriculum Review</Link>
          </>}{slug && <>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="font-bold">
              {title}
            </span>
          </>}
        </nav>
      </header>
      <div id="admin-content" className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        {slug && <div className="mb-5">
          <Link href={parent} className="text-sm font-semibold text-[#3558AE] hover:underline">← {["publish", "approve"].includes(slug) ? "Back to Curriculum Review" : slug === "lesson-preview" ? "Back to Lesson Content" : "Back to Curriculum Studio"}
          </Link>
        </div>}
        {children}
      </div>
    </div>
  </div>;
}
