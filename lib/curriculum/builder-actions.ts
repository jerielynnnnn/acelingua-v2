
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const BUILDER_PATH = "/admin/curriculum/builder";

type ActionResult = {
  ok: boolean;
  message: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DIFFICULTIES = [
  "beginner",
  "intermediate",
  "advanced",
] as const;

type Difficulty = (typeof DIFFICULTIES)[number];

function getText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function requiredText(
  form: FormData,
  name: string,
  maxLength: number
): string {
  const value = getText(form, name);

  if (!value || value.length > maxLength) {
    throw new Error(
      `${name.replaceAll("_", " ")} must be between 1 and ${maxLength} characters.`
    );
  }

  return value;
}

function optionalText(
  form: FormData,
  name: string,
  maxLength: number
): string | null {
  const value = getText(form, name);

  if (value.length > maxLength) {
    throw new Error(
      `${name.replaceAll("_", " ")} exceeds ${maxLength} characters.`
    );
  }

  return value || null;
}

function parseDifficulty(form: FormData): Difficulty {
  const value = getText(form, "difficulty");

  if (
    !DIFFICULTIES.includes(value as Difficulty)
  ) {
    throw new Error("Select a valid course difficulty.");
  }

  return value as Difficulty;
}

function friendlyError(message: string): string {
  if (message.includes("23505")) {
    return "A record with the same unique value already exists.";
  }

  return message;
}

function destination(
  result: ActionResult,
  languageId?: string
): never {
  const params = new URLSearchParams({
    [result.ok ? "success" : "error"]: result.message,
  });

  if (languageId && validUuid(languageId)) {
    params.set("language", languageId);
  }

  redirect(`${BUILDER_PATH}?${params.toString()}`);
}

function refreshBuilder(): void {
  revalidatePath(BUILDER_PATH);
  revalidatePath("/admin/curriculum");
  revalidatePath("/learn");
  revalidatePath("/dashboard");
}

export async function saveLanguageAction(
  form: FormData
): Promise<void> {
  await requireAccount("admin");

  let id = "";
  let code = "";
  let name = "";
  let nativeName: string | null = null;
  let flagEmoji: string | null = null;

  try {
    id = getText(form, "id");
    code = requiredText(form, "code", 20).toLowerCase();
    name = requiredText(form, "name", 100);
    nativeName = optionalText(form, "native_name", 100);
    flagEmoji = optionalText(form, "flag_emoji", 20);

    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(code)) {
      throw new Error(
        "Use a valid language code, such as ja, ko, es, or en-us."
      );
    }

    if (id && !validUuid(id)) {
      throw new Error("Invalid language ID.");
    }
  } catch (error) {
    destination({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Invalid language information.",
    });
  }

  const supabase = await createClient();

  const values = {
    code,
    name,
    native_name: nativeName,
    flag_emoji: flagEmoji,
  };

  const { error } = id
    ? await supabase
        .from("languages")
        .update(values)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase
        .from("languages")
        .insert({
          ...values,
          is_active: false,
        })
        .select("id")
        .single();

  if (error) {
    destination({
      ok: false,
      message: friendlyError(error.message),
    });
  }

  refreshBuilder();

  destination({
    ok: true,
    message: id
      ? "Language updated successfully."
      : "Language created as inactive.",
  });
}

export async function setLanguageActiveAction(
  form: FormData
): Promise<void> {
  await requireAccount("admin");

  const id = getText(form, "id");
  const target = getText(form, "active");

  if (!validUuid(id) || !["true", "false"].includes(target)) {
    destination({
      ok: false,
      message: "Invalid language activation request.",
    });
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("languages")
    .update({ is_active: target === "true" })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    destination({ ok: false, message: error.message });
  }

  refreshBuilder();

  destination({
    ok: true,
    message:
      target === "true"
        ? "Language activated."
        : "Language deactivated. Its courses are hidden from learners.",
  });
}

export async function saveCourseAction(
  form: FormData
): Promise<void> {
  await requireAccount("admin");

  let id = "";
  let languageId = "";
  let title = "";
  let description: string | null = null;
  let difficulty: Difficulty = "beginner";

  try {
    id = getText(form, "id");
    languageId = getText(form, "language_id");
    title = requiredText(form, "title", 150);
    description = optionalText(form, "description", 3000);
    difficulty = parseDifficulty(form);

    if (!validUuid(languageId)) {
      throw new Error("Select a language.");
    }

    if (id && !validUuid(id)) {
      throw new Error("Invalid course ID.");
    }
  } catch (error) {
    destination({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Invalid course information.",
    });
  }

  const supabase = await createClient();

  // Verify parent exists. RLS applies to this query.
  const { data: language, error: parentError } =
    await supabase
      .from("languages")
      .select("id")
      .eq("id", languageId)
      .maybeSingle();

  if (parentError || !language) {
    destination({
      ok: false,
      message: "The selected language no longer exists.",
    });
  }

  const values = {
    language_id: languageId,
    title,
    description,
    difficulty,
  };

  const { error } = id
    ? await supabase
        .from("courses")
        .update(values)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase
        .from("courses")
        .insert({
          ...values,
          status: "draft",
        })
        .select("id")
        .single();

  if (error) {
    destination({
      ok: false,
      message: friendlyError(error.message),
    });
  }

  refreshBuilder();

  destination(
    {
      ok: true,
      message: id
        ? "Course updated successfully."
        : "Course created as draft.",
    },
    languageId
  );
}

export async function setCourseStatusAction(
  form: FormData
): Promise<void> {
  await requireAccount("admin");

  const id = getText(form, "id");
  const status = getText(form, "status");

  if (
    !validUuid(id) ||
    !["draft", "published", "archived"].includes(status)
  ) {
    destination({
      ok: false,
      message: "Invalid course status request.",
    });
  }

  const supabase = await createClient();

  const { data: course, error: lookupError } =
    await supabase
      .from("courses")
      .select("id, language_id, status")
      .eq("id", id)
      .maybeSingle();

  if (lookupError || !course) {
    destination({
      ok: false,
      message: "Course not found.",
    });
  }

  if (status === "published") {
    const { data: language, error: languageError } =
      await supabase
        .from("languages")
        .select("is_active")
        .eq("id", course.language_id)
        .single();

    if (
      languageError ||
      !language?.is_active
    ) {
      destination({
        ok: false,
        message:
          "Activate the parent language before publishing.",
      }, course.language_id);
    }
  }

  const { error } = await supabase
    .from("courses")
    .update({ status })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    destination(
      { ok: false, message: error.message },
      course.language_id
    );
  }

  refreshBuilder();

  destination(
    {
      ok: true,
      message: `Course status changed to ${status}.`,
    },
    course.language_id
  );
}

// Deletion is intentionally not included in the first builder.
// Courses will soon contain child units and lessons.
// We'll implement explicit dependency-aware deletion later.
