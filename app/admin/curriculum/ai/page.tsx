
import { Suspense } from "react";
import { connection } from "next/server";

import AICurriculumGenerator from "@/components/admin/AICurriculumGenerator";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

async function AICurriculumContent() {
  await connection();
  await requireAccount("admin");

  const supabase = await createClient();

  const [coursesResult, languagesResult, unitsResult] =
    await Promise.all([
      supabase
        .from("courses")
        .select(
          "id, title, difficulty, status, language_id"
        )
        .order("title"),

      supabase
        .from("languages")
        .select("id, name, flag_emoji"),

      supabase
        .from("units")
        .select("id, course_id, title, unit_number")
        .order("unit_number"),
    ]);

  if (coursesResult.error) {
    throw new Error(coursesResult.error.message);
  }

  if (languagesResult.error) {
    throw new Error(languagesResult.error.message);
  }

  if (unitsResult.error) {
    throw new Error(unitsResult.error.message);
  }

  const languages = languagesResult.data ?? [];

  const courses = (coursesResult.data ?? []).map(
    (course) => {
      const language = languages.find(
        (item) => item.id === course.language_id
      );

      return {
        id: course.id,
        title: course.title,
        difficulty: course.difficulty,
        status: course.status,
        languageName: language?.name ?? "Unknown",
        flagEmoji: language?.flag_emoji ?? "🌐",
      };
    }
  );

  const units = (unitsResult.data ?? []).map((unit) => ({
    id: unit.id,
    courseId: unit.course_id,
    title: unit.title,
    unitNumber: unit.unit_number,
  }));

  return (
    <AICurriculumGenerator
      courses={courses}
      units={units}
    />
  );
}

export default function AICurriculumPage() {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-screen items-center justify-center bg-[#f9f2ff]"
        >
          <p className="text-sm font-semibold text-[#3558AE]">
            Loading AI Curriculum Generator...
          </p>
        </main>
      }
    >
      <AICurriculumContent />
    </Suspense>
  );
}
