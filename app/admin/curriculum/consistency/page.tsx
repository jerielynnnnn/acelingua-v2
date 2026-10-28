import AdminLessonSelection from "@/components/admin/AdminLessonSelection";

import { Suspense } from "react";
import { connection } from "next/server";

import LessonConsistencyPanel from "@/components/admin/LessonConsistencyPanel";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

import {
  analyzeLessonConsistency,
  type VocabularyRecord,
} from "@/lib/curriculum/consistency";

type Props = {
  searchParams: Promise<{ lesson?: string }>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function object(value: unknown): Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function Content({ searchParams }: Props) {
  await connection();
  await requireAccount("admin");

  const params = await searchParams;
  const supabase = await createClient();

  const [coursesResult, unitsResult, lessonsResult] =
    await Promise.all([
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
    ]);

  for (const result of [
    coursesResult,
    unitsResult,
    lessonsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const courses = (coursesResult.data ?? []).map((course) => ({
    id: course.id,
    title: course.title,
  }));

  const courseIds = new Set(courses.map((course) => course.id));

  const units = (unitsResult.data ?? [])
    .filter((unit) => courseIds.has(unit.course_id))
    .map((unit) => ({
      id: unit.id,
      courseId: unit.course_id,
      number: unit.unit_number,
      title: unit.title,
    }));

  const unitIds = new Set(units.map((unit) => unit.id));

  const lessons = (lessonsResult.data ?? [])
    .filter((lesson) => unitIds.has(lesson.unit_id))
    .map((lesson) => ({
      id: lesson.id,
      unitId: lesson.unit_id,
      number: lesson.lesson_number,
      title: lesson.title,
    }));

  const selected = params.lesson && UUID.test(params.lesson) ? lessons.find(item => item.id === params.lesson) : undefined;
  if (!selected) return <AdminLessonSelection courses={courses} units={units} lessons={lessons} slug="consistency" />;

  const selectedUnit = units.find(
    (item) => item.id === selected.unitId
  );

  if (!selectedUnit) {
    throw new Error("The selected lesson's unit was not found.");
  }

  const relatedLessonIds = lessons
    .filter((lesson) => {
      const unit = units.find((item) => item.id === lesson.unitId);
      return unit?.courseId === selectedUnit.courseId;
    })
    .map((item) => item.id);

  const [
    vocabularyResult,
    stepsResult,
    activitiesResult,
    assessmentResult,
    courseVocabularyResult,
  ] = await Promise.all([
    supabase
      .from("lesson_vocabulary")
      .select("id, lesson_id, phrase, meaning")
      .eq("lesson_id", selected.id)
      .neq("status", "archived"),

    supabase
      .from("lesson_steps")
      .select(
        "id, step_number, step_type, title, content"
      )
      .eq("lesson_id", selected.id)
      .neq("status", "archived")
      .order("step_number"),

    supabase
      .from("lesson_activities")
      .select(
        "id, activity_number, activity_type, title, content, answer_config"
      )
      .eq("lesson_id", selected.id)
      .neq("status", "archived")
      .order("activity_number"),

    supabase
      .from("ai_assessment_drafts")
      .select("id, title, questions")
      .eq("lesson_id", selected.id)
      .maybeSingle(),

    supabase
      .from("lesson_vocabulary")
      .select("id, lesson_id, phrase, meaning")
      .in("lesson_id", relatedLessonIds)
      .neq("status", "archived"),
  ]);

  for (const result of [
    vocabularyResult,
    stepsResult,
    activitiesResult,
    assessmentResult,
    courseVocabularyResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const vocabulary: VocabularyRecord[] =
    vocabularyResult.data ?? [];

  const report = analyzeLessonConsistency({
    lessonId: selected.id,
    lessonTitle: selected.title,
    vocabulary,

    courseVocabulary: courseVocabularyResult.data ?? [],

    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
    })),

    steps: (stepsResult.data ?? []).map((step) => ({
      id: step.id,
      step_number: step.step_number,
      step_type: step.step_type,
      title: step.title,
      content: object(step.content),
    })),

    activities: (activitiesResult.data ?? []).map(
      (activity) => ({
        id: activity.id,
        activity_number: activity.activity_number,
        activity_type: activity.activity_type,
        title: activity.title,
        content: object(activity.content),
        answer_config: object(activity.answer_config),
      })
    ),

    assessment: assessmentResult.data
      ? {
          id: assessmentResult.data.id,
          title: assessmentResult.data.title,
          questions: assessmentResult.data.questions,
        }
      : null,
  });

  return (
    <LessonConsistencyPanel
      courses={courses}
      units={units}
      lessons={lessons}
      selectedLessonId={selected.id}
      report={report}
    />
  );
}

export default function ConsistencyPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-screen items-center justify-center bg-[#f9f2ff] text-[#3558AE]"
        >
          Checking lesson consistency...
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
