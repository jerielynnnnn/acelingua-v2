import AdminLessonSelection from "@/components/admin/AdminLessonSelection";

import { Suspense } from "react";
import { connection } from "next/server";

import AIPracticeGenerator from "@/components/admin/AIPracticeGenerator";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ lesson?: string }> };

async function PracticeGeneratorContent({ searchParams }: Props) {
  await connection();
  await requireAccount("admin");

  const params = await searchParams;
  const supabase = await createClient();

  const [
    coursesResult,
    unitsResult,
    lessonsResult,
    vocabularyResult,
    activitiesResult,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, status")
      .eq("status", "draft")
      .order("title"),

    supabase
      .from("units")
      .select("id, course_id, title, unit_number, status")
      .eq("status", "draft")
      .order("unit_number"),

    supabase
      .from("lessons")
      .select("id, unit_id, title, lesson_number, status")
      .eq("status", "draft")
      .order("lesson_number"),

    supabase
      .from("lesson_vocabulary")
      .select("lesson_id"),

    supabase
      .from("lesson_activities")
      .select("lesson_id"),
  ]);

  for (const result of [
    coursesResult,
    unitsResult,
    lessonsResult,
    vocabularyResult,
    activitiesResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const courses = (coursesResult.data ?? []).map(
    (course) => ({
      id: course.id,
      title: course.title,
    })
  );

  const validCourseIds = new Set(
    courses.map((course) => course.id)
  );

  const units = (unitsResult.data ?? [])
    .filter((unit) =>
      validCourseIds.has(unit.course_id)
    )
    .map((unit) => ({
      id: unit.id,
      courseId: unit.course_id,
      title: unit.title,
      number: unit.unit_number,
    }));

  const validUnitIds = new Set(
    units.map((unit) => unit.id)
  );

  const vocabularyCounts = new Map<string, number>();
  const activityCounts = new Map<string, number>();

  for (const row of vocabularyResult.data ?? []) {
    vocabularyCounts.set(
      row.lesson_id,
      (vocabularyCounts.get(row.lesson_id) ?? 0) + 1
    );
  }

  for (const row of activitiesResult.data ?? []) {
    activityCounts.set(
      row.lesson_id,
      (activityCounts.get(row.lesson_id) ?? 0) + 1
    );
  }

  const lessons = (lessonsResult.data ?? [])
    .filter((lesson) =>
      validUnitIds.has(lesson.unit_id)
    )
    .map((lesson) => ({
      id: lesson.id,
      unitId: lesson.unit_id,
      title: lesson.title,
      number: lesson.lesson_number,
      vocabularyCount:
        vocabularyCounts.get(lesson.id) ?? 0,
      activityCount:
        activityCounts.get(lesson.id) ?? 0,
    }));

  if (!lessons.some(lesson => lesson.id === params.lesson)) return <AdminLessonSelection courses={courses} units={units} lessons={lessons} slug="practice-ai" />;

  return (
    <AIPracticeGenerator
      key={params.lesson}
      initialLessonId={params.lesson}
      courses={courses}
      units={units}
      lessons={lessons}
    />
  );
}

export default function PracticeAIPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-screen items-center justify-center bg-[#f9f2ff]"
        >
          Loading Practice Generator...
        </main>
      }
    >
      <PracticeGeneratorContent {...props} />
    </Suspense>
  );
}
