import AdminLessonSelection from "@/components/admin/AdminLessonSelection";

import { Suspense } from "react";
import { connection } from "next/server";

import CurriculumReadinessPanel from "@/components/admin/CurriculumReadinessPanel";

import { getLessonReadiness } from "@/lib/curriculum/readiness";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    lesson?: string;
  }>;
};

async function ReviewContent({
  searchParams,
}: PageProps) {
  await connection();
  await requireAccount("admin");

  const params = await searchParams;
  const supabase = await createClient();

  const [
    coursesResult,
    unitsResult,
    lessonsResult,
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

  const courses = (coursesResult.data ?? [])
    .filter((item) => item.status === "draft")
    .map((item) => ({
      id: item.id,
      title: item.title,
    }));

  const validCourseIds = new Set(
    courses.map((course) => course.id)
  );

  const units = (unitsResult.data ?? [])
    .filter(
      (item) =>
        item.status === "draft" &&
        validCourseIds.has(item.course_id)
    )
    .map((item) => ({
      id: item.id,
      courseId: item.course_id,
      title: item.title,
      number: item.unit_number,
    }));

  const validUnitIds = new Set(
    units.map((unit) => unit.id)
  );

  const lessons = (lessonsResult.data ?? [])
    .filter(
      (item) =>
        item.status === "draft" &&
        validUnitIds.has(item.unit_id)
    )
    .map((item) => ({
      id: item.id,
      unitId: item.unit_id,
      title: item.title,
      number: item.lesson_number,
    }));

  const chosenLesson =
    lessons.find(
      (item) => item.id === params.lesson
    );

  if (!chosenLesson) return <AdminLessonSelection courses={courses} units={units} lessons={lessons} slug="review" />;

  const report = chosenLesson
    ? await getLessonReadiness(chosenLesson.id)
    : null;

  return (
    <CurriculumReadinessPanel
      key={chosenLesson.id}
      courses={courses}
      units={units}
      lessons={lessons}
      selectedLessonId={chosenLesson?.id ?? ""}
      report={report}
    />
  );
}

export default function CurriculumReviewPage(
  props: PageProps
) {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-screen items-center justify-center bg-[#f9f2ff] text-[#3558AE]"
        >
          Loading curriculum review...
        </main>
      }
    >
      <ReviewContent {...props} />
    </Suspense>
  );
}
