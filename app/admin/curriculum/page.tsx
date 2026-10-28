import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { activityTypes } from "@/lib/curriculum/activity-types";
import { lessonHref, studioGroups, validLessonId } from "@/lib/admin/navigation";
async function Studio({ searchParams }: {
  searchParams: Promise<{
    lesson?: string;
  }>;
}) {
  await connection();
  await requireAccount("admin");
  const { lesson: requestedLesson } = await searchParams;
  let lesson: string | undefined;
  if (validLessonId(requestedLesson)) {
    const db = await createClient();
    const { data, error } = await db.from("lessons").select("id").eq("id", requestedLesson).maybeSingle();
    if (error) throw new Error(error.message);
    lesson = data?.id;
  }
  return <main>
    <Link href="/admin" className="text-sm font-semibold text-[#3558AE]">Back to Dashboard</Link>
    <header className="my-7">
      <h1 className="text-3xl font-extrabold">Curriculum Studio</h1>
      <p className="mt-3 text-slate-600">Create a curriculum, build lesson experiences, then review and publish approved content.</p>
    </header>
    <div className="grid gap-6 xl:grid-cols-2">
      {studioGroups.map(group => <section key={group.title} className="rounded-3xl border border-white bg-white/85 p-6 shadow-sm">
        <h2 className="text-xl font-bold">
          {group.title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {group.description}
        </p>
        <ul className="mt-5 space-y-3">
          {group.tools.map(([slug, title, description]) => <li key={slug}>
            {["approve", "publish", "lesson-preview"].includes(slug) && !validLessonId(lesson) ? <div className="rounded-xl bg-slate-50 p-4">
              <p className="font-bold">
                {title}
              </p>
              <p className="mt-1 text-sm text-slate-500">Select a lesson in <Link href="/admin/curriculum/review" className="text-[#3558AE] underline">Curriculum Review</Link> first.</p>
            </div> : <Link href={lessonHref(slug, lesson)} className="block rounded-xl border border-[#C7A9D4]/25 p-4 transition-colors hover:bg-[#eeeafd]">
              <h3 className="font-bold text-[#3558AE]">
                {title} &rarr;</h3>
              <p className="mt-1 text-sm text-slate-600">
                {description}
              </p>
            </Link>}
          </li>)}
        </ul>
      </section>)}
    </div>
    <details className="mt-6 rounded-2xl border border-white bg-white/80 p-5">
      <summary className="cursor-pointer font-bold">Registered activity formats ({activityTypes.length})</summary>
      <p className="mt-3 text-sm text-slate-600">The visual Activity Builder supports flip cards, matching, multiple choice, and word order. Other registered formats may require the content tools.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activityTypes.map(activity => <li key={activity.id} className="rounded-xl bg-[#f4f1ff] p-3"><h3 className="font-semibold">{activity.label}</h3><p className="mt-1 text-sm text-slate-600">{activity.description}</p></li>)}
      </ul>
    </details>
  </main>;
}
export default function CurriculumPage(props: {
  searchParams: Promise<{
    lesson?: string;
  }>;
}) {
  return <Suspense fallback={<p role="status">Loading Curriculum Studio...</p>}>
    <Studio {...props} />
  </Suspense>;
}
