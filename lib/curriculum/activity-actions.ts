
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const PATH = "/admin/curriculum/activities";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUPPORTED_TYPES = [
  "flip_cards",
  "matching",
  "multiple_choice",
  "word_order",
] as const;

type SupportedType = (typeof SUPPORTED_TYPES)[number];

type ActivityPayload = {
  content: Record<string, unknown>;
  answer_config: Record<string, unknown>;
};

function read(form: FormData, key: string): string {
  const raw = form.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function validId(id: string): boolean {
  return UUID.test(id);
}

function lines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function pairs(raw: string): {
  left: string;
  right: string;
}[] {
  const rows = lines(raw);

  const result = rows.map((row, index) => {
    const separator = row.indexOf("|");

    if (separator < 1 || separator === row.length - 1) {
      throw new Error(
        `Row ${index + 1} must use: Japanese | English`
      );
    }

    const left = row.slice(0, separator).trim();
    const right = row.slice(separator + 1).trim();

    if (
      !left ||
      !right ||
      left.length > 200 ||
      right.length > 200
    ) {
      throw new Error(
        `Row ${index + 1} contains an invalid word or meaning.`
      );
    }

    return { left, right };
  });

  if (result.length === 0 || result.length > 30) {
    throw new Error("Enter between 1 and 30 word pairs.");
  }

  return result;
}

function requireUnique(values: string[], field: string) {
  const normalized = values.map((value) =>
    value.toLocaleLowerCase().trim()
  );

  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${field} must contain unique values.`);
  }
}

function buildPayload(
  type: SupportedType,
  form: FormData
): ActivityPayload {
  if (type === "flip_cards") {
    const cards = pairs(read(form, "pairs"));

    return {
      content: {
        cards: cards.map(({ left, right }) => ({
          front: left,
          back: right,
        })),
      },
      answer_config: {},
    };
  }

  if (type === "matching") {
    const wordPairs = pairs(read(form, "pairs"));

    if (wordPairs.length < 2) {
      throw new Error(
        "Matching requires at least two word pairs."
      );
    }

    requireUnique(
      wordPairs.map((pair) => pair.left),
      "Japanese words"
    );
    requireUnique(
      wordPairs.map((pair) => pair.right),
      "English meanings"
    );

    // Presentation values are stored separately from
    // the answer mapping.
    return {
      content: {
        leftItems: wordPairs.map((pair) => pair.left),
        rightItems: wordPairs
          .map((pair) => pair.right)
          .reverse(),
      },
      answer_config: {
        pairs: wordPairs,
      },
    };
  }

  if (type === "multiple_choice") {
    const options = lines(read(form, "options"));

    if (options.length < 2 || options.length > 6) {
      throw new Error(
        "Multiple choice requires 2 to 6 answer options."
      );
    }

    if (options.some((option) => option.length > 200)) {
      throw new Error(
        "Each answer option must be 200 characters or fewer."
      );
    }

    requireUnique(options, "Answer choices");

    const answer = read(form, "correct_answer");

    if (!options.includes(answer)) {
      throw new Error(
        "The correct answer must exactly match one option."
      );
    }

    return {
      content: { options },
      answer_config: { answer },
    };
  }

  const phrase = read(form, "phrase");

  const tokens = phrase.split(/\s+/).filter(Boolean);

  if (
    tokens.length < 2 ||
    tokens.length > 20 ||
    phrase.length > 500
  ) {
    throw new Error(
      "Word Jumble requires a sentence of 2 to 20 words."
    );
  }

  return {
    content: {
      tiles: [...tokens].reverse(),
    },
    answer_config: {
      tokens,
    },
  };
}

function go(
  lessonId: string,
  key: "success" | "error",
  message: string
): never {
  const params = new URLSearchParams({ [key]: message });

  if (validId(lessonId)) {
    params.set("lesson", lessonId);
  }

  redirect(`${PATH}?${params.toString()}`);
}

export async function saveActivityAction(
  form: FormData
): Promise<void> {
  await requireAccount("admin");

  const lessonId = read(form, "lesson_id");
  const id = read(form, "id");
  const typeRaw = read(form, "activity_type");

  if (!validId(lessonId) || (id && !validId(id))) {
    go(lessonId, "error", "Invalid activity or lesson ID.");
  }

  if (
    !SUPPORTED_TYPES.includes(
      typeRaw as SupportedType
    )
  ) {
    go(lessonId, "error", "Unsupported activity type.");
  }

  const type = typeRaw as SupportedType;
  const title = read(form, "title");
  const instructions = read(form, "instructions");
  const numberRaw = read(form, "activity_number");
  const activityNumber = Number(numberRaw);

  if (!title || title.length > 150) {
    go(
      lessonId,
      "error",
      "Activity title must contain 1–150 characters."
    );
  }

  if (instructions.length > 1000) {
    go(
      lessonId,
      "error",
      "Instructions must be 1000 characters or fewer."
    );
  }

  if (
    !numberRaw ||
    !Number.isSafeInteger(activityNumber) ||
    activityNumber < 1 ||
    activityNumber > 10000
  ) {
    go(
      lessonId,
      "error",
      "Activity number must be a positive whole number."
    );
  }

  let payload: ActivityPayload;

  try {
    payload = buildPayload(type, form);
  } catch (error) {
    go(
      lessonId,
      "error",
      error instanceof Error
        ? error.message
        : "Activity content is invalid."
    );
  }

  const supabase = await createClient();

  const { data: lesson, error: lessonError } =
    await supabase
      .from("lessons")
      .select("id")
      .eq("id", lessonId)
      .maybeSingle();

  if (lessonError || !lesson) {
    go(lessonId, "error", "Lesson not found.");
  }

  if (id) {
    const { data: existing, error: existingError } =
      await supabase
        .from("lesson_activities")
        .select("id, status")
        .eq("id", id)
        .eq("lesson_id", lessonId)
        .maybeSingle();

    if (existingError || !existing) {
      go(lessonId, "error", "Activity not found.");
    }

    if (existing.status === "published") {
      go(
        lessonId,
        "error",
        "Unpublish this activity before editing it."
      );
    }
  }

  const values = {
    lesson_id: lessonId,
    activity_number: activityNumber,
    title,
    instructions: instructions || null,
    activity_type: type,
    content: payload.content,
    answer_config: payload.answer_config,
  };

  const result = id
    ? await supabase
        .from("lesson_activities")
        .update(values)
        .eq("id", id)
        .eq("lesson_id", lessonId)
        .neq("status", "published")
        .select("id")
        .single()
    : await supabase
        .from("lesson_activities")
        .insert({
          ...values,
          status: "draft",
        })
        .select("id")
        .single();

  if (result.error) {
    const message =
      result.error.code === "23505"
        ? "This activity number is already used in the lesson."
        : result.error.message;

    go(lessonId, "error", message);
  }

  revalidatePath(PATH);
  revalidatePath("/admin/curriculum");

  go(
    lessonId,
    "success",
    id
      ? "Activity updated successfully."
      : "Draft activity created successfully."
  );
}
