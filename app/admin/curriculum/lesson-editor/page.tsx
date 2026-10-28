import { loadStudioContext } from "@/lib/curriculum/lesson-studio-context";
import AdminLessonSelection from "@/components/admin/AdminLessonSelection";

import { Suspense } from "react";
import { connection } from "next/server";

import LessonContentManager from "@/components/admin/LessonContentManager";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ lesson?: string }>;
};

type Course = {
  id: string;
  title: string;
};

type Unit = {
  id: string;
  courseId: string;
  title: string;
  number: number;
};

type Lesson = {
  id: string;
  unitId: string;
  title: string;
  number: number;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


async function Content({ searchParams }: Props) {
  await connection();
  await requireAccount("admin");

  const params = await searchParams;
  const supabase = await createClient();

  const [cResult, uResult, lResult] = await Promise.all([
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

  for (const result of [cResult, uResult, lResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const courses: Course[] = (cResult.data ?? []).map(
    (item) => ({
      id: item.id,
      title: item.title,
    })
  );

  const courseIds = new Set(courses.map((item) => item.id));

  const units: Unit[] = (uResult.data ?? [])
    .filter((item) => courseIds.has(item.course_id))
    .map((item) => ({
      id: item.id,
      courseId: item.course_id,
      title: item.title,
      number: item.unit_number,
    }));

  const unitIds = new Set(units.map((item) => item.id));

  const lessons: Lesson[] = (lResult.data ?? [])
    .filter((item) => unitIds.has(item.unit_id))
    .map((item) => ({
      id: item.id,
      unitId: item.unit_id,
      title: item.title,
      number: item.lesson_number,
    }));

  const selected = params.lesson && UUID.test(params.lesson) ? lessons.find(item => item.id === params.lesson) : undefined;
  if (!selected) return <AdminLessonSelection courses={courses} units={units} lessons={lessons} slug="lesson-editor" />;

  const selectedUnit = units.find(
    (unit) => unit.id === selected.unitId
  );

  if (!selectedUnit) {
    throw new Error("Selected lesson unit not found.");
  }

  const studio = await loadStudioContext(selected.id);
  return <LessonContentManager key={selected.id} courses={courses} units={units} lessons={lessons} selectedLessonId={selected.id} studio={studio} />;
}

export default function LessonEditorPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f9f2ff] text-[#3558AE]">
          Loading Lesson Content Studio...
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
