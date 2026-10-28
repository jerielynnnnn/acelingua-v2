
import { Suspense } from "react";
import { connection } from "next/server";

import LanguageCourseBuilder, {
  type CourseRow,
  type LanguageRow,
} from "@/components/admin/LanguageCourseBuilder";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{
    language?: string;
    success?: string;
    error?: string;
  }>;
};

async function BuilderContent({
  searchParams,
}: Props) {
  await connection();

  // Auth must run before any Admin database operations.
  await requireAccount("admin");

  const params = await searchParams;
  const supabase = await createClient();

  const [languagesResult, coursesResult] =
    await Promise.all([
      supabase
        .from("languages")
        .select(
          "id, code, name, native_name, flag_emoji, is_active"
        )
        .order("name", { ascending: true }),

      supabase
        .from("courses")
        .select(
          "id, language_id, title, description, difficulty, status"
        )
        .order("created_at", { ascending: false }),
    ]);

  if (languagesResult.error) {
    throw new Error(
      `Unable to load languages: ${languagesResult.error.message}`
    );
  }

  if (coursesResult.error) {
    throw new Error(
      `Unable to load courses: ${coursesResult.error.message}`
    );
  }

  const languages =
    (languagesResult.data ?? []) as LanguageRow[];

  const allCourses =
    (coursesResult.data ?? []) as CourseRow[];

  const selectedLanguage =
    languages.some(
      (language) => language.id === params.language
    )
      ? params.language
      : undefined;

  const courses = selectedLanguage
    ? allCourses.filter(
        (course) =>
          course.language_id === selectedLanguage
      )
    : allCourses;

  return (
    <LanguageCourseBuilder
      languages={languages}
      courses={courses}
      selectedLanguage={selectedLanguage}
      success={params.success}
      error={params.error}
    />
  );
}

export default function CurriculumBuilderPage(
  props: Props
) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f9f2ff]">
          <p className="text-sm font-semibold text-[#3558AE]">
            Loading Language & Course Builder...
          </p>
        </main>
      }
    >
      <BuilderContent {...props} />
    </Suspense>
  );
}
