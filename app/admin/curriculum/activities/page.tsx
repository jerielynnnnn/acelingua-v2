import AdminLessonSelection from "@/components/admin/AdminLessonSelection";

import { Suspense } from "react";
import { connection } from "next/server";

import ActivityBuilder, {
  type ActivityRow,
  type CourseOption,
  type UnitOption,
  type LessonOption,
} from "@/components/admin/ActivityBuilder";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{
    course?: string;
    unit?: string;
    lesson?: string;
    success?: string;
    error?: string;
  }>;
};

async function ActivityContent({ searchParams }: Props) {
  await connection();
  await requireAccount("admin");

  const params = await searchParams;
  const supabase = await createClient();

  const [
    languagesResult,
    coursesResult,
    unitsResult,
    lessonsResult,
  ] = await Promise.all([
    supabase
      .from("languages")
      .select("id, name, flag_emoji"),

    supabase
      .from("courses")
      .select("id, title, language_id, status")
      .order("title", { ascending: true }),

    supabase
      .from("units")
      .select("id, course_id, unit_number, title")
      .order("unit_number", { ascending: true }),

    supabase
      .from("lessons")
      .select("id, unit_id, lesson_number, title")
      .order("lesson_number", { ascending: true }),
  ]);

  if (languagesResult.error) {
    throw new Error(languagesResult.error.message);
  }

  if (coursesResult.error) {
    throw new Error(coursesResult.error.message);
  }

  if (unitsResult.error) {
    throw new Error(unitsResult.error.message);
  }

  if (lessonsResult.error) {
    throw new Error(lessonsResult.error.message);
  }

  const languages = languagesResult.data ?? [];

  const courses: CourseOption[] = (
    coursesResult.data ?? []
  )
    .map((course) => {
      const language = languages.find(
        (item) => item.id === course.language_id
      );

      return {
        id: course.id,
        title: course.title,
        status: course.status,
        languageName: language?.name ?? "Unknown language",
        flagEmoji: language?.flag_emoji ?? "🌐",
      };
    })
    .sort(
      (a, b) =>
        a.languageName.localeCompare(b.languageName) ||
        a.title.localeCompare(b.title)
    );

  const units: UnitOption[] = (
    unitsResult.data ?? []
  ).map((unit) => ({
    id: unit.id,
    courseId: unit.course_id,
    number: unit.unit_number,
    title: unit.title,
  }));

  const lessons: LessonOption[] = (
    lessonsResult.data ?? []
  ).map((lesson) => ({
    id: lesson.id,
    unitId: lesson.unit_id,
    number: lesson.lesson_number,
    title: lesson.title,
  }));

  if (!lessons.some(lesson => lesson.id === params.lesson)) return <AdminLessonSelection courses={courses} units={units} lessons={lessons} slug="activities" />;

  // Select the course containing the requested lesson
  // when the lesson is specified directly by the roadmap.
  const directLesson = lessons.find(
    (lesson) => lesson.id === params.lesson
  );

  const directUnit = directLesson
    ? units.find((unit) => unit.id === directLesson.unitId)
    : null;

  const requestedCourseId =
    directUnit?.courseId ?? params.course;

  const selectedCourseId =
    courses.find((course) => course.id === requestedCourseId)
      ?.id ??
    courses[0]?.id ??
    null;

  const courseUnits = units
    .filter((unit) => unit.courseId === selectedCourseId)
    .sort(
      (a, b) =>
        a.number - b.number ||
        a.title.localeCompare(b.title)
    );

  const requestedUnitId =
    directUnit?.courseId === selectedCourseId
      ? directUnit.id
      : params.unit;

  const selectedUnitId =
    courseUnits.find((unit) => unit.id === requestedUnitId)
      ?.id ??
    courseUnits[0]?.id ??
    null;

  const unitLessons = lessons
    .filter((lesson) => lesson.unitId === selectedUnitId)
    .sort(
      (a, b) =>
        a.number - b.number ||
        a.title.localeCompare(b.title)
    );

  const selectedLessonId =
    unitLessons.find((lesson) => lesson.id === params.lesson)
      ?.id ??
    unitLessons[0]?.id ??
    null;

  let activities: ActivityRow[] = [];

  if (selectedLessonId) {
    const { data, error } = await supabase
      .from("lesson_activities")
      .select(
        "id, lesson_id, activity_number, title, instructions, activity_type, content, answer_config, status"
      )
      .eq("lesson_id", selectedLessonId)
      .order("activity_number", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    activities = (data ?? []) as ActivityRow[];
  }

  return (
    <ActivityBuilder
      key={selectedLessonId}
      courses={courses}
      units={units}
      lessons={lessons}
      courseId={selectedCourseId}
      unitId={selectedUnitId}
      lessonId={selectedLessonId}
      activities={activities}
      success={params.success}
      error={params.error}
    />
  );
}

export default function ActivitiesPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f9f2ff]">
          <p
            role="status"
            className="font-semibold text-[#3558AE]"
          >
            Loading Interactive Activity Builder...
          </p>
        </main>
      }
    >
      <ActivityContent {...props} />
    </Suspense>
  );
}
