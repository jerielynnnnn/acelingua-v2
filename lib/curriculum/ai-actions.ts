
"use server";

import { revalidatePath } from "next/cache";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

import {
  validateOutline,
  type GeneratedOutline,
} from "@/lib/curriculum/ai-outline";

import { generateOutlineWithOllama } from "@/lib/curriculum/ollama";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type GenerateInput = {
  courseId: string;
  goals: string;
};

type SaveInput = {
  courseId: string;
  outline: GeneratedOutline;
};

type SaveStatistics = {
  created_units: number;
  created_lessons: number;
  skipped_units: number;
  skipped_lessons: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

async function getCourseContext(courseId: string) {
  if (!UUID_REGEX.test(courseId)) {
    throw new Error("Invalid course ID.");
  }

  const supabase = await createClient();

  const { data: course, error: courseError } =
    await supabase
      .from("courses")
      .select(
        "id, title, difficulty, description, language_id, status"
      )
      .eq("id", courseId)
      .single();

  if (courseError || !course) {
    throw new Error("Course not found.");
  }

  if (course.status !== "draft") {
    throw new Error(
      "AI generation currently supports draft courses only."
    );
  }

  const { data: language, error: languageError } =
    await supabase
      .from("languages")
      .select("name, code")
      .eq("id", course.language_id)
      .single();

  if (languageError || !language) {
    throw new Error("Course language not found.");
  }

  const { data: units, error: unitsError } =
    await supabase
      .from("units")
      .select("id, title, unit_number")
      .eq("course_id", course.id)
      .order("unit_number");

  if (unitsError) {
    throw new Error(unitsError.message);
  }

  const unitIds = (units ?? []).map((unit) => unit.id);

  let existingLessons: Array<{
    unit_id: string;
    title: string;
  }> = [];

  if (unitIds.length > 0) {
    const { data, error } = await supabase
      .from("lessons")
      .select("unit_id, title")
      .in("unit_id", unitIds);

    if (error) {
      throw new Error(error.message);
    }

    existingLessons = data ?? [];
  }

  const existingCurriculum = (units ?? []).map(
    (unit) => ({
      unit: unit.title,
      lessons: existingLessons
        .filter((lesson) => lesson.unit_id === unit.id)
        .map((lesson) => lesson.title),
    })
  );

  const nextUnitNumber =
    (units ?? []).reduce(
      (highest, unit) =>
        Math.max(highest, unit.unit_number),
      0
    ) + 1;

  return {
    language: language.name,
    languageCode: language.code,
    courseTitle: course.title,
    difficulty: course.difficulty,
    description: course.description,
    nextUnitNumber,
    existingCurriculum,
  };
}

/* =========================================================
   GENERATE ONE NEXT UNIT
========================================================= */

export async function generateCurriculumAction(
  input: GenerateInput
): Promise<ActionResult<GeneratedOutline>> {
  await requireAccount("admin");

  try {
    if (
      !input ||
      !UUID_REGEX.test(input.courseId) ||
      typeof input.goals !== "string" ||
      input.goals.trim().length < 10 ||
      input.goals.length > 1200
    ) {
      throw new Error(
        "Select a course and enter at least 10 characters of learning goals."
      );
    }

    const context =
      await getCourseContext(input.courseId);

    const outline = await generateOutlineWithOllama({
      language: context.language,
      languageCode: context.languageCode,
      courseTitle: context.courseTitle,
      difficulty: context.difficulty,
      description: context.description,
      goals:
        `Propose the NEXT logical unit in the course. ` +
        `Its expected roadmap position is Unit ` +
        `${context.nextUnitNumber}. ` +
        `Create a coherent sequence of 3 to 6 lessons. ` +
        `Do not repeat existing units or lessons. ` +
        `Admin learning goals: ${input.goals.trim()}`,
      unitCount: 1,
      existingCurriculum: context.existingCurriculum,
    });

    if (outline.units.length !== 1) {
      throw new Error(
        "Ollama must generate exactly one new unit."
      );
    }

    const candidateTitle =
      outline.units[0].title.trim().toLowerCase();

    if (
      context.existingCurriculum.some(
        (unit) =>
          unit.unit.trim().toLowerCase() ===
          candidateTitle
      )
    ) {
      throw new Error(
        "Ollama generated a unit that already exists. " +
        "Try again with more specific learning goals."
      );
    }

    return {
      ok: true,
      data: outline,
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}

/* =========================================================
   SAVE ADMIN-APPROVED DRAFT
========================================================= */

export async function saveGeneratedCurriculumAction(
  input: SaveInput
): Promise<ActionResult<SaveStatistics>> {
  await requireAccount("admin");

  try {
    if (!input || !UUID_REGEX.test(input.courseId)) {
      throw new Error("Invalid course ID.");
    }

    const outline = validateOutline(input.outline);

    if (outline.units.length !== 1) {
      throw new Error(
        "Next-unit generation must contain exactly one unit."
      );
    }

    // Recheck that the selected course is still a draft.
    const context =
      await getCourseContext(input.courseId);

    const proposedUnitName =
      outline.units[0].title.trim().toLowerCase();

    if (
      context.existingCurriculum.some(
        (unit) =>
          unit.unit.trim().toLowerCase() ===
          proposedUnitName
      )
    ) {
      throw new Error(
        "A unit with this title already exists. " +
        "Edit the draft title or generate a new unit."
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "import_ai_curriculum_outline",
      {
        p_course_id: input.courseId,
        p_outline: outline,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (
      !data ||
      typeof data.created_units !== "number" ||
      typeof data.created_lessons !== "number" ||
      typeof data.skipped_units !== "number" ||
      typeof data.skipped_lessons !== "number"
    ) {
      throw new Error(
        "Unexpected database import response."
      );
    }

    revalidatePath("/admin");
    revalidatePath("/admin/curriculum");
    revalidatePath("/admin/curriculum/ai");
    revalidatePath("/admin/curriculum/builder");
    revalidatePath("/admin/curriculum/roadmap");

    return {
      ok: true,
      data: data as SaveStatistics,
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}
