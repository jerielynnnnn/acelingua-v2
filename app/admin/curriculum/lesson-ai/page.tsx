import AdminLessonSelection from "@/components/admin/AdminLessonSelection";

import { Suspense } from "react";
import { connection } from "next/server";

import AILessonStudio from "@/components/admin/AILessonStudio";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{
    lesson?: string;
  }>;
};

export type CourseOption = {
  id: string;
  title: string;
};

export type UnitOption = {
  id: string;
  courseId: string;
  unitNumber: number;
  title: string;
};

export type LessonOption = {
  id: string;
  unitId: string;
  lessonNumber: number;
  title: string;
  hasSteps: boolean;
};

async function Content({ searchParams }: Props) {
  await connection();
  await requireAccount("admin");

  const params = await searchParams;
  const supabase = await createClient();

  const [
    coursesResult,
    unitsResult,
    lessonsResult,
    stepsResult,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, status")
      .order("title"),

    supabase
      .from("units")
      .select(
        "id, course_id, title, unit_number, status"
      )
      .order("unit_number"),

    supabase
      .from("lessons")
      .select(
        "id, unit_id, title, lesson_number, status"
      )
      .order("lesson_number"),

    supabase
      .from("lesson_steps")
      .select("lesson_id"),
  ]);

  if (coursesResult.error) {
    throw new Error(coursesResult.error.message);
  }

  if (unitsResult.error) {
    throw new Error(unitsResult.error.message);
  }

  if (lessonsResult.error) {
    throw new Error(lessonsResult.error.message);
  }

  if (stepsResult.error) {
    throw new Error(stepsResult.error.message);
  }

  // Only draft courses are editable by the AI generator.
  const draftCourses = (coursesResult.data ?? [])
    .filter((course) => course.status === "draft");

  const validCourseIds = new Set(
    draftCourses.map((course) => course.id)
  );

  const draftUnits = (unitsResult.data ?? [])
    .filter(
      (unit) =>
        unit.status === "draft" &&
        validCourseIds.has(unit.course_id)
    );

  const validUnitIds = new Set(
    draftUnits.map((unit) => unit.id)
  );

  const savedLessonIds = new Set(
    (stepsResult.data ?? []).map(
      (step) => step.lesson_id
    )
  );

  const draftLessons = (lessonsResult.data ?? [])
    .filter(
      (lesson) =>
        lesson.status === "draft" &&
        validUnitIds.has(lesson.unit_id)
    );

  const courses: CourseOption[] = draftCourses.map(
    (course) => ({
      id: course.id,
      title: course.title,
    })
  );

  const units: UnitOption[] = draftUnits.map(
    (unit) => ({
      id: unit.id,
      courseId: unit.course_id,
      unitNumber: unit.unit_number,
      title: unit.title,
    })
  );

  const lessons: LessonOption[] = draftLessons.map(
    (lesson) => ({
      id: lesson.id,
      unitId: lesson.unit_id,
      lessonNumber: lesson.lesson_number,
      title: lesson.title,
      hasSteps: savedLessonIds.has(lesson.id),
    })
  );

  if (!lessons.some(lesson => lesson.id === params.lesson)) return <AdminLessonSelection courses={courses} units={units} lessons={lessons} slug="lesson-ai" />;

  return (
    <AILessonStudio
      key={params.lesson}
      courses={courses}
      units={units}
      lessons={lessons}
      initialLessonId={params.lesson}
    />
  );
}

export default function AILessonPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f9f2ff] text-[#3558AE]">
          Loading AI Lesson Studio...
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
