import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { lessonHref } from "@/lib/admin/navigation";
function hasRelatedRows(value: unknown): boolean { return Array.isArray(value) ? value.length > 0 : value !== null && typeof value === "object" && "id" in value; }
const card = "rounded-2xl border border-white bg-white/90 p-5 shadow-sm";
async function Overview() {
  await connection();
  const account = await requireAccount("admin");
  const db = await createClient();
  const [languages, courses, units, lessons, drafts, snapshots, recent, curriculum, attention] = await Promise.all([
    db.from("languages").select("id", { count: "exact", head: true }).eq("is_active", true),
    db.from("courses").select("id", { count: "exact", head: true }),
    db.from("units").select("id", { count: "exact", head: true }),
    db.from("lessons").select("id", { count: "exact", head: true }),
    db.from("lessons").select("id", { count: "exact", head: true }).eq("status", "draft"),
    db.from("published_lesson_snapshots").select("lesson_id", { count: "exact", head: true }).eq("status", "published"),
    db.from("published_lesson_snapshots").select("lesson_id, lesson_title, course_title, published_at").eq("status", "published").order("published_at", { ascending: false }).limit(6),
    db.from("courses").select("id, title, status, units(id, lessons(id))").order("title").limit(8),
    db.from("lessons").select("id, title, lesson_steps(id), ai_assessment_drafts(id)").eq("status", "draft").order("id").limit(12),
  ]);
  const errors = [languages, courses, units, lessons, drafts, snapshots, recent, curriculum, attention].filter(result => result.error);
  const stats = [["Active languages", languages], ["Courses", courses], ["Units", units], ["Lessons", lessons], ["Draft lessons", drafts], ["Published snapshots", snapshots]] as const;
  return <main className="space-y-8">
    <header className="flex flex-wrap items-center justify-between gap-5">
      <div>
        <h1 className="text-3xl font-extrabold">Welcome, {account.displayName || "Administrator"}
        </h1>
        <p className="mt-3 text-slate-600">Your curriculum and publishing overview.</p>
      </div>
      <Link href="/admin/curriculum" className="rounded-xl bg-[#3558AE] px-5 py-3 font-bold text-white hover:bg-[#2A255C]">Open Curriculum Studio &rarr;</Link>
    </header>
    {!!errors.length && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Some dashboard data could not be loaded. Unavailable counts show N/A. Refresh to retry.</p>}
    <section aria-label="Platform statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {stats.map(([label, result]) => <article key={label} className={card}>
        <p className="text-sm font-semibold text-slate-600">
          {label}
        </p>
        <p className="mt-3 text-3xl font-extrabold tabular-nums">
          {result.error ? "N/A" : result.count ?? 0}
        </p>
      </article>)}
    </section>
    <section>
      <h2 className="mb-4 text-xl font-bold">Quick actions</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {[["lesson-editor", "Continue Editing Lessons"], ["review", "Review Content"], ["activities", "Manage Activities"]].map(([slug, label]) => <Link key={slug} href={lessonHref(slug)} className={card + " font-bold text-[#3558AE] hover:bg-[#eeeafd]"}>
          {label} &rarr;</Link>)}
      </div>
    </section>
    <section className={card}>
      <h2 className="text-xl font-bold">Curriculum progress</h2>
      <p className="mt-2 text-sm text-slate-500">First eight courses by title. Draft status and published snapshots are tracked separately.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3">Course</th>
              <th className="p-3">Units</th>
              <th className="p-3">Lessons</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(curriculum.data ?? []).map(course => <tr key={course.id} className="border-b border-slate-100">
              <td className="p-3">
                <Link className="font-semibold text-[#3558AE] hover:underline" href={lessonHref("roadmap", null, { course: course.id })}>
                  {course.title}
                </Link>
              </td>
              <td className="p-3">
                {course.units.length}
              </td>
              <td className="p-3">
                {course.units.reduce((sum, unit) => sum + unit.lessons.length, 0)}
              </td>
              <td className="p-3 capitalize">
                {course.status}
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!curriculum.data?.length && <p className="mt-4 text-sm text-slate-500">
        {curriculum.error ? "Course overview unavailable." : "No courses yet. Start in Curriculum Studio."}
      </p>}
    </section>
    <div className="grid gap-6 xl:grid-cols-2">
      <section className={card}>
        <h2 className="text-xl font-bold">Action required</h2>
        <p className="mt-2 text-sm text-slate-500">Sample of the first 12 drafts by ID; open Review for full readiness checks.</p>
        <ul className="mt-4 space-y-3">
          {(attention.data ?? []).map(item => {
            const missingContent = !item.lesson_steps.length; const missingAssessment = !hasRelatedRows(item.ai_assessment_drafts); return <li key={item.id}>
              <Link href={lessonHref(missingContent ? "lesson-ai" : missingAssessment ? "assessment-ai" : "review", item.id)} className="block rounded-xl bg-[#f4f1ff] p-3 hover:bg-[#eeeafd]">
                <p className="font-semibold">
                  {item.title}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {missingContent ? "No teaching steps saved" : missingAssessment ? "No assessment draft saved" : "Draft available for review"}
                </p>
              </Link>
            </li>;
          })}
        </ul>
        {!attention.data?.length && <p className="mt-4 text-sm text-slate-500">
          {attention.error ? "Attention queue unavailable." : "No draft lessons to review."}
        </p>}
      </section>
      <section className={card}>
        <h2 className="text-xl font-bold">Recently published lessons</h2>
        <ul className="mt-4 space-y-3">
          {(recent.data ?? []).map(item => <li key={item.lesson_id} className="rounded-xl bg-[#f4f1ff] p-3">
            <Link href={lessonHref("publish", item.lesson_id)} className="font-semibold text-[#3558AE] hover:underline">
              {item.lesson_title}
            </Link>
            <p className="mt-1 text-sm text-slate-600">
              {item.course_title}
            </p>
            <time className="text-xs text-slate-500" dateTime={item.published_at}>
              {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(item.published_at))}
            </time>
          </li>)}
        </ul>
        {!recent.data?.length && <p className="mt-4 text-sm text-slate-500">
          {recent.error ? "Publication history unavailable." : "No published snapshots yet."}
        </p>}
      </section>
    </div>
  </main>;
}
export default function AdminPage() {
  return <Suspense fallback={<p role="status">Loading Admin overview...</p>}>
    <Overview />
  </Suspense>;
}
