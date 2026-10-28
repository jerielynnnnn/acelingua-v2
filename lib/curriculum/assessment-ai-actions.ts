
"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type AssessmentQuestion = {
  prompt: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

export type AssessmentDraft = {
  title: string;
  questions: AssessmentQuestion[];
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function lessonInformation(lessonId: string) {
  if (!UUID.test(lessonId)) {
    throw new Error("Invalid lesson ID.");
  }

  const supabase = await createClient();

  const { data: lesson, error: lessonError } =
    await supabase
      .from("lessons")
      .select("id, unit_id, title, status")
      .eq("id", lessonId)
      .single();

  if (lessonError || !lesson) {
    throw new Error("Lesson not found.");
  }

  const { data: unit, error: unitError } =
    await supabase
      .from("units")
      .select("course_id, title, status")
      .eq("id", lesson.unit_id)
      .single();

  if (unitError || !unit) {
    throw new Error("Unit not found.");
  }

  const { data: course, error: courseError } =
    await supabase
      .from("courses")
      .select("title, status")
      .eq("id", unit.course_id)
      .single();

  if (courseError || !course) {
    throw new Error("Course not found.");
  }

  if (
    lesson.status !== "draft" ||
    unit.status !== "draft" ||
    course.status !== "draft"
  ) {
    throw new Error("Only draft curriculum is supported.");
  }

  const { data: vocabulary, error: vocabularyError } =
    await supabase
      .from("lesson_vocabulary")
      .select(
        "phrase, meaning, usage_note, vocabulary_number"
      )
      .eq("lesson_id", lessonId)
      .eq("status", "draft")
      .order("vocabulary_number");

  if (vocabularyError) {
    throw new Error(vocabularyError.message);
  }

  const unique: Array<{
    phrase: string;
    meaning: string;
    usage_note: string;
  }> = [];

  for (const entry of vocabulary ?? []) {
    if (
      !unique.some(
        (item) =>
          item.meaning.toLowerCase() ===
          entry.meaning.toLowerCase()
      )
    ) {
      unique.push({
        phrase: entry.phrase,
        meaning: entry.meaning,
        usage_note: entry.usage_note,
      });
    }
  }

  if (unique.length < 3) {
    throw new Error(
      "This lesson needs at least three vocabulary entries " +
      "with distinct meanings."
    );
  }

  const { count, error: draftError } = await supabase
    .from("ai_assessment_drafts")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);

  if (draftError) {
    throw new Error(draftError.message);
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      "An assessment draft already exists for this lesson."
    );
  }

  return {
    lessonTitle: lesson.title,
    courseTitle: course.title,
    unitTitle: unit.title,
    vocabulary: unique.slice(0, 5),
  };
}

function ollamaEndpoint(): URL {
  const url = new URL(
    process.env.OLLAMA_BASE_URL ||
      "http://127.0.0.1:11434"
  );

  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "11434" ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid local Ollama configuration.");
  }

  return new URL("/api/chat", url);
}

async function generateExplanations(
  info: Awaited<ReturnType<typeof lessonInformation>>
): Promise<string[]> {
  const vocabulary = info.vocabulary.slice(0, 3);

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["explanations"],
    properties: {
      explanations: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string" },
      },
    },
  };

  let response: Response;

  try {
    response = await fetch(ollamaEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(180000),
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.2:3b",
        stream: false,
        format: schema,
        options: {
          temperature: 0.1,
          num_predict: 450,
        },
        messages: [
          {
            role: "system",
            content:
              "You are a language assessment writer. " +
              "Write exactly three short educational explanations " +
              "in English, one for each vocabulary item, in order. " +
              "Use the supplied approved meanings. " +
              "Do not change, question, or invent their translations. " +
              "Each explanation must be 10 to 300 characters. " +
              "Return only JSON.",
          },
          {
            role: "user",
            content: JSON.stringify({
              lesson: info.lessonTitle,
              vocabulary,
            }),
          },
        ],
      }),
    });
  } catch {
    throw new Error(
      "Ollama could not complete the assessment request. " +
      "Check that the model is running."
    );
  }

  if (!response.ok) {
    throw new Error(
      `Ollama returned HTTP ${response.status}.`
    );
  }

  const json = (await response.json()) as {
    message?: { content?: string };
  };

  if (!json.message?.content) {
    throw new Error("Ollama returned no assessment content.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(json.message.content);
  } catch {
    throw new Error("Ollama returned invalid assessment JSON.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("explanations" in parsed)
  ) {
    throw new Error("Assessment explanations are missing.");
  }

  const explanations = (
    parsed as { explanations: unknown }
  ).explanations;

  if (
    !Array.isArray(explanations) ||
    explanations.length !== 3 ||
    explanations.some(
      (item) =>
        typeof item !== "string" ||
        item.trim().length < 10 ||
        item.length > 300
    )
  ) {
    throw new Error(
      "Ollama returned invalid explanation text."
    );
  }

  return explanations.map((item: string) => item.trim());
}

function validateQuestions(
  questions: AssessmentQuestion[]
) {
  if (
    !Array.isArray(questions) ||
    questions.length < 3 ||
    questions.length > 5
  ) {
    throw new Error("An assessment needs 3–5 questions.");
  }

  for (const question of questions) {
    const options = question.options;

    if (
      clean(question.prompt).length < 5 ||
      clean(question.prompt).length > 300 ||
      !Array.isArray(options) ||
      options.length !== 3 ||
      options.some(
        (option) =>
          typeof option !== "string" ||
          !option.trim() ||
          option.length > 200
      ) ||
      new Set(
        options.map((item) => item.trim().toLowerCase())
      ).size !== 3 ||
      !options.includes(question.correct_answer) ||
      clean(question.explanation).length < 5 ||
      clean(question.explanation).length > 500
    ) {
      throw new Error(
        "Review the assessment questions and answer choices."
      );
    }
  }
}

export async function generateAssessmentAction(
  lessonId: string
): Promise<Result<AssessmentDraft>> {
  await requireAccount("admin");

  try {
    const info = await lessonInformation(lessonId);
    const vocabulary = info.vocabulary.slice(0, 3);

    const explanations = await generateExplanations(info);
    const meanings = vocabulary.map((item) => item.meaning);

    const questions: AssessmentQuestion[] =
      vocabulary.map((item, index) => {
        const options = [
          ...meanings.slice(index),
          ...meanings.slice(0, index),
        ];

        return {
          prompt:
            `What is the meaning of "${item.phrase}"?`,
          options,
          correct_answer: item.meaning,
          explanation: explanations[index],
        };
      });

    validateQuestions(questions);

    return {
      ok: true,
      data: {
        title: `${info.lessonTitle} — Knowledge Check`,
        questions,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
    };
  }
}

export async function saveAssessmentAction(input: {
  lessonId: string;
  draft: AssessmentDraft;
}): Promise<Result<{ id: string }>> {
  await requireAccount("admin");

  try {
    if (!input || !UUID.test(input.lessonId)) {
      throw new Error("Invalid lesson.");
    }

    const info = await lessonInformation(input.lessonId);

    if (
      clean(input.draft.title).length < 3 ||
      clean(input.draft.title).length > 150
    ) {
      throw new Error("Invalid assessment title.");
    }

    validateQuestions(input.draft.questions);

    // Ensure the submitted answer keys still correspond
    // to approved-in-Admin vocabulary.
    const vocabulary = info.vocabulary;
    const sourceMeanings = new Set(
      vocabulary.map((item) => item.meaning)
    );

    for (const question of input.draft.questions) {
      if (!sourceMeanings.has(question.correct_answer)) {
        throw new Error(
          "An assessment answer no longer matches the " +
          "saved lesson vocabulary."
        );
      }
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "save_ai_assessment_draft",
      {
        p_lesson_id: input.lessonId,
        p_title: input.draft.title.trim(),
        p_questions: input.draft.questions,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (typeof data !== "string") {
      throw new Error("Invalid assessment save response.");
    }

    revalidatePath("/admin/curriculum");
    revalidatePath("/admin/curriculum/assessment-ai");

    return {
      ok: true,
      data: { id: data },
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
    };
  }
}
