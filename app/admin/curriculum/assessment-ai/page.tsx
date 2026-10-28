import AdminLessonSelection from "@/components/admin/AdminLessonSelection";

import { Suspense } from "react";
import { connection } from "next/server";

import AIAssessmentGenerator from "@/components/admin/AIAssessmentGenerator";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ lesson?: string }> };

async function AssessmentContent({ searchParams }: Props) {
  await connection();
  await requireAccount("admin");

  const params = await searchParams;
  const supabase = await createClient();

  const [
    coursesResult,
    unitsResult,
    lessonsResult,
    vocabularyResult,
    draftsResult,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, status")
      .eq("status", "draft")
      .order("title"),

    supabase
      .from("units")
      .select("id, course_id, unit_number, title, status")
      .eq("status", "draft")
      .order("unit_number"),

    supabase
      .from("lessons")
      .select("id, unit_id, lesson_number, title, status")
      .eq("status", "draft")
      .order("lesson_number"),

    supabase
      .from("lesson_vocabulary")
      .select("lesson_id")
      .eq("status", "draft"),

    supabase
      .from("ai_assessment_drafts")
      .select("lesson_id"),
  ]);

  const results = [
    coursesResult,
    unitsResult,
    lessonsResult,
    vocabularyResult,
    draftsResult,
  ];

  for (const result of results) {
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

  const courseIds = new Set(
    courses.map((course) => course.id)
  );

  const units = (unitsResult.data ?? [])
    .filter((unit) => courseIds.has(unit.course_id))
    .map((unit) => ({
      id: unit.id,
      courseId: unit.course_id,
      number: unit.unit_number,
      title: unit.title,
    }));

  const unitIds = new Set(
    units.map((unit) => unit.id)
  );

  const vocabularyCounts = new Map<string, number>();

  for (const item of vocabularyResult.data ?? []) {
    vocabularyCounts.set(
      item.lesson_id,
      (vocabularyCounts.get(item.lesson_id) ?? 0) + 1
    );
  }

  const assessmentIds = new Set(
    (draftsResult.data ?? []).map(
      (draft) => draft.lesson_id
    )
  );

  const lessons = (lessonsResult.data ?? [])
    .filter((lesson) => unitIds.has(lesson.unit_id))
    .map((lesson) => ({
      id: lesson.id,
      unitId: lesson.unit_id,
      number: lesson.lesson_number,
      title: lesson.title,
      vocabularyCount:
        vocabularyCounts.get(lesson.id) ?? 0,
      hasAssessment: assessmentIds.has(lesson.id),
    }));

  if (!lessons.some(lesson => lesson.id === params.lesson)) return <AdminLessonSelection courses={courses} units={units} lessons={lessons} slug="assessment-ai" />;

  return (
    <AIAssessmentGenerator
      key={params.lesson}
      initialLessonId={params.lesson}
      courses={courses}
      units={units}
      lessons={lessons}
    />
  );
}

export default function AssessmentAIPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f9f2ff] text-[#3558AE]">
          Loading AI Assessment Generator...
        </main>
      }
    >
      <AssessmentContent {...props} />
    </Suspense>
  );
}
