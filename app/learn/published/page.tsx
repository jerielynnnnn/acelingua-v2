
import { Suspense } from "react";
import { connection } from "next/server";

import PublishedCourseRoadmap, {
  type PublishedLesson,
} from "@/components/learn/PublishedCourseRoadmap";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

async function RoadmapContent() {
  await connection();

  // Only signed-in learner accounts can access this page.
  await requireAccount("learner");

  const supabase = await createClient();

  // IMPORTANT:
  // Use a literal select string for Supabase type inference.
  const { data, error } = await supabase
    .from("published_lesson_snapshots")
    .select(
      "lesson_id, course_id, unit_id, course_title, unit_title, lesson_title, published_at"
    )
    .eq("status", "published")
    .order("published_at", { ascending: true });

  if (error) {
    throw new Error(
      `Unable to load published lessons: ${error.message}`
    );
  }

  const lessons: PublishedLesson[] = (data ?? []).map(
    (item) => ({
      lessonId: item.lesson_id,
      courseId: item.course_id,
      unitId: item.unit_id,
      courseTitle: item.course_title,
      unitTitle: item.unit_title,
      lessonTitle: item.lesson_title,
      publishedAt: item.published_at,
    })
  );

  return <PublishedCourseRoadmap lessons={lessons} />;
}

export default function PublishedRoadmapPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f9f2ff] px-6 text-center text-[#3558AE]">
          Loading your learning roadmap...
        </main>
      }
    >
      <RoadmapContent />
    </Suspense>
  );
}
