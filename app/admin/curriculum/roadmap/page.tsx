
import { Suspense } from "react";
import { connection } from "next/server";

import UnitLessonBuilder, {
  type RoadmapCourse,
  type RoadmapLanguage,
  type RoadmapUnit,
  type RoadmapLesson,
} from "@/components/admin/UnitLessonBuilder";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { validLessonId } from "@/lib/admin/navigation";

type Props = {
  searchParams: Promise<{
    course?: string;
    lesson?: string;
    success?: string;
    error?: string;
  }>;
};

async function RoadmapContent({ searchParams }: Props) {
  await connection();
  await requireAccount("admin");

  const params = await searchParams;
  const supabase = await createClient();

  const [courseResult, languageResult] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, difficulty, status, language_id")
      .order("title"),

    supabase
      .from("languages")
      .select("id, name, flag_emoji")
      .order("name"),
  ]);

  if (courseResult.error) {
    throw new Error(courseResult.error.message);
  }

  if (languageResult.error) {
    throw new Error(languageResult.error.message);
  }

  const courses =
    (courseResult.data ?? []) as RoadmapCourse[];

  const languages =
    (languageResult.data ?? []) as RoadmapLanguage[];

  let contextCourseId = params.course;
  if (validLessonId(params.lesson)) {
    const { data: lesson, error } = await supabase.from("lessons").select("unit_id").eq("id", params.lesson).maybeSingle();
    if (error) throw new Error(error.message);
    if (lesson) {
      const { data: unit, error: unitError } = await supabase.from("units").select("course_id").eq("id", lesson.unit_id).maybeSingle();
      if (unitError) throw new Error(unitError.message);
      contextCourseId = unit?.course_id;
    }
  }
  const selectedCourse =
    courses.find((course) => course.id === contextCourseId)?.id ??
    courses[0]?.id ??
    null;

  let units: RoadmapUnit[] = [];
  let lessons: RoadmapLesson[] = [];

  if (selectedCourse) {
    const { data: unitData, error: unitError } =
      await supabase
        .from("units")
        .select(
          "id, course_id, unit_number, title, description, status"
        )
        .eq("course_id", selectedCourse)
        .order("unit_number");

    if (unitError) {
      throw new Error(unitError.message);
    }

    units = (unitData ?? []) as RoadmapUnit[];

    const unitIds = units.map((unit) => unit.id);

    if (unitIds.length > 0) {
      const { data: lessonData, error: lessonError } =
        await supabase
          .from("lessons")
          .select(
            "id, unit_id, lesson_number, title, description, lesson_type, status"
          )
          .in("unit_id", unitIds)
          .order("lesson_number");

      if (lessonError) {
        throw new Error(lessonError.message);
      }

      lessons = (lessonData ?? []) as RoadmapLesson[];
    }
  }

  return (
    <UnitLessonBuilder
      courses={courses}
      languages={languages}
      units={units}
      lessons={lessons}
      selectedCourse={selectedCourse}
      success={params.success}
      error={params.error}
    />
  );
}

export default function RoadmapPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f9f2ff]">
          <p className="text-sm font-semibold text-[#3558AE]">
            Loading Course Roadmap Builder...
          </p>
        </main>
      }
    >
      <RoadmapContent {...props} />
    </Suspense>
  );
}
