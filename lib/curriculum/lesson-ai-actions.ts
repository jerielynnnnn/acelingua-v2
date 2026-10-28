
"use server";

import { revalidatePath } from "next/cache";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

import {
  generateLessonWithOllama,
  validateLessonPackage,
  type LessonPackage,
} from "@/lib/curriculum/lesson-ai";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const localeMap: Record<string, string> = {
  ja: "ja-JP",
  jp: "ja-JP",
  ko: "ko-KR",
  kr: "ko-KR",
  fr: "fr-FR",
  th: "th-TH",
  es: "es-ES",
  en: "en-US",
  de: "de-DE",
  it: "it-IT",
  zh: "zh-CN",
  fil: "fil-PH",
};

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unexpected lesson generation error.";
}

async function loadLessonContext(lessonId: string) {
  if (!UUID.test(lessonId)) {
    throw new Error("Invalid lesson ID.");
  }

  const supabase = await createClient();

  const { data: lesson, error: lessonError } =
    await supabase
      .from("lessons")
      .select("id, unit_id, title, description, status")
      .eq("id", lessonId)
      .single();

  if (lessonError || !lesson) {
    throw new Error("Lesson not found.");
  }

  const { data: unit, error: unitError } =
    await supabase
      .from("units")
      .select("id, course_id, title, status")
      .eq("id", lesson.unit_id)
      .single();

  if (unitError || !unit) {
    throw new Error("Unit not found.");
  }

  const { data: course, error: courseError } =
    await supabase
      .from("courses")
      .select(
        "id, language_id, title, difficulty, status"
      )
      .eq("id", unit.course_id)
      .single();

  if (courseError || !course) {
    throw new Error("Course not found.");
  }

  const { data: language, error: languageError } =
    await supabase
      .from("languages")
      .select("name, code")
      .eq("id", course.language_id)
      .single();

  if (languageError || !language) {
    throw new Error("Language not found.");
  }

  if (
    lesson.status !== "draft" ||
    unit.status !== "draft" ||
    course.status !== "draft"
  ) {
    throw new Error(
      "Only lessons under draft units and draft courses can be generated."
    );
  }

  const { count, error: stepsError } =
    await supabase
      .from("lesson_steps")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("lesson_id", lessonId);

  if (stepsError) {
    throw new Error(stepsError.message);
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      "This lesson already contains AI lesson steps. " +
      "Generation does not overwrite existing content."
    );
  }

  const code = language.code.toLowerCase();

  const locale = localeMap[code];

  if (!locale) {
    throw new Error(
      `Language "${language.name}" has no configured ` +
      "speech locale yet. Add it to localeMap first."
    );
  }

  return {
    courseTitle: course.title,
    level: course.difficulty,
    language: language.name,
    locale,
    unitTitle: unit.title,
    lessonTitle: lesson.title,
    objective: lesson.description ?? "",
  };
}

export async function generateLessonContentAction(
  input: {
    lessonId: string;
    instructions: string;
  }
): Promise<Result<LessonPackage>> {
  await requireAccount("admin");

  try {
    if (
      !input ||
      !UUID.test(input.lessonId) ||
      typeof input.instructions !== "string" ||
      input.instructions.length > 1000
    ) {
      throw new Error("Invalid lesson generation request.");
    }

    const context =
      await loadLessonContext(input.lessonId);

    const lesson = await generateLessonWithOllama({
      ...context,
      instructions: input.instructions.trim(),
    });

    return {
      ok: true,
      data: lesson,
    };
  } catch (error) {
    return {
      ok: false,
      error: errorText(error),
    };
  }
}

export async function saveLessonContentAction(
  input: {
    lessonId: string;
    lessonPackage: LessonPackage;
  }
): Promise<
  Result<{
    created_vocabulary: number;
    created_steps: number;
  }>
> {
  await requireAccount("admin");

  try {
    if (!input || !UUID.test(input.lessonId)) {
      throw new Error("Invalid lesson ID.");
    }

    const context =
      await loadLessonContext(input.lessonId);

    const validated =
      validateLessonPackage(input.lessonPackage);

    const lessonPackage = {
      ...validated,
      language_locale: context.locale,
    };

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "save_ai_lesson_package",
      {
        p_lesson_id: input.lessonId,
        p_package: lessonPackage,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (
      !data ||
      typeof data.created_vocabulary !== "number" ||
      typeof data.created_steps !== "number"
    ) {
      throw new Error("Invalid database save response.");
    }

    revalidatePath("/admin/curriculum");
    revalidatePath("/admin/curriculum/lesson-ai");
    revalidatePath("/admin/curriculum/lesson-preview");

    return {
      ok: true,
      data: {
        created_vocabulary: data.created_vocabulary,
        created_steps: data.created_steps,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: errorText(error),
    };
  }
}
