
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const ROADMAP_PATH = "/admin/curriculum/roadmap";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function value(form: FormData, key: string): string {
  const raw = form.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function uuid(raw: string): boolean {
  return UUID_REGEX.test(raw);
}

function required(
  form: FormData,
  key: string,
  max: number
): string {
  const text = value(form, key);

  if (!text || text.length > max) {
    throw new Error(
      `${key.replaceAll("_", " ")} must contain 1–${max} characters.`
    );
  }

  return text;
}

function optional(
  form: FormData,
  key: string,
  max: number
): string | null {
  const text = value(form, key);

  if (text.length > max) {
    throw new Error(`${key} must be at most ${max} characters.`);
  }

  return text || null;
}

function positiveInteger(
  form: FormData,
  key: string
): number {
  const raw = value(form, key);
  const number = Number(raw);

  if (
    !raw ||
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > 10000
  ) {
    throw new Error(
      `${key.replaceAll("_", " ")} must be a whole number between 1 and 10000.`
    );
  }

  return number;
}

type MessageKind = "success" | "error";

function back(
  kind: MessageKind,
  message: string,
  courseId?: string
): never {
  const params = new URLSearchParams({
    [kind]: message,
  });

  if (courseId && uuid(courseId)) {
    params.set("course", courseId);
  }

  redirect(`${ROADMAP_PATH}?${params.toString()}`);
}

function refresh(): void {
  revalidatePath(ROADMAP_PATH);
  revalidatePath("/admin/curriculum");
  revalidatePath("/learn");
}

function errorMessage(
  error: { message: string; code?: string }
): string {
  if (error.code === "23505") {
    return "This position is already used within the parent. Choose another number.";
  }

  if (error.code === "23503") {
    return "The selected parent record no longer exists.";
  }

  return error.message;
}

export async function saveUnitAction(
  form: FormData
): Promise<void> {
  await requireAccount("admin");

  const id = value(form, "id");
  const courseId = value(form, "course_id");

  if (!uuid(courseId) || (id && !uuid(id))) {
    back("error", "Invalid course or unit identifier.");
  }

  let title: string;
  let description: string | null;
  let unitNumber: number;

  try {
    title = required(form, "title", 150);
    description = optional(form, "description", 3000);
    unitNumber = positiveInteger(form, "unit_number");
  } catch (error) {
    back(
      "error",
      error instanceof Error
        ? error.message
        : "Invalid unit information.",
      courseId
    );
  }

  const supabase = await createClient();

  const { data: course, error: courseError } =
    await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .maybeSingle();

  if (courseError || !course) {
    back("error", "The course does not exist.", courseId);
  }

  const record = {
    course_id: courseId,
    title,
    description,
    unit_number: unitNumber,
  };

  const result = id
    ? await supabase
        .from("units")
        .update(record)
        .eq("id", id)
        .eq("course_id", courseId)
        .select("id")
        .single()
    : await supabase
        .from("units")
        .insert({
          ...record,
          status: "draft",
        })
        .select("id")
        .single();

  if (result.error) {
    back("error", errorMessage(result.error), courseId);
  }

  refresh();

  back(
    "success",
    id ? "Unit updated successfully." : "Draft unit created.",
    courseId
  );
}

export async function saveLessonAction(
  form: FormData
): Promise<void> {
  await requireAccount("admin");

  const id = value(form, "id");
  const unitId = value(form, "unit_id");
  const courseId = value(form, "course_id");

  if (
    !uuid(unitId) ||
    !uuid(courseId) ||
    (id && !uuid(id))
  ) {
    back("error", "Invalid lesson, unit, or course identifier.");
  }

  let title: string;
  let description: string | null;
  let lessonNumber: number;
  let lessonType: string;

  try {
    title = required(form, "title", 150);
    description = optional(form, "description", 3000);
    lessonNumber = positiveInteger(form, "lesson_number");
    lessonType = value(form, "lesson_type") || "standard";

    if (!["standard", "conversation", "review"].includes(lessonType)) {
      throw new Error("Invalid lesson type.");
    }
  } catch (error) {
    back(
      "error",
      error instanceof Error
        ? error.message
        : "Invalid lesson information.",
      courseId
    );
  }

  const supabase = await createClient();

  // Verify the selected unit actually belongs to this course.
  const { data: unit, error: unitError } =
    await supabase
      .from("units")
      .select("id, course_id")
      .eq("id", unitId)
      .eq("course_id", courseId)
      .maybeSingle();

  if (unitError || !unit) {
    back(
      "error",
      "The selected unit does not belong to this course.",
      courseId
    );
  }

  const record = {
    unit_id: unitId,
    lesson_number: lessonNumber,
    title,
    description,
    lesson_type: lessonType,
  };

  const result = id
    ? await supabase
        .from("lessons")
        .update(record)
        .eq("id", id)
        .eq("unit_id", unitId)
        .select("id")
        .single()
    : await supabase
        .from("lessons")
        .insert({
          ...record,
          status: "draft",
        })
        .select("id")
        .single();

  if (result.error) {
    back("error", errorMessage(result.error), courseId);
  }

  refresh();

  back(
    "success",
    id
      ? "Lesson updated successfully."
      : "Draft lesson created.",
    courseId
  );
}
