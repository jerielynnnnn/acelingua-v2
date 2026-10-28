
"use server";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type KnowledgeQuestion = {
  id: number;
  prompt: string;
  options: string[];
};

export type KnowledgeResult = {
  attempted: true;
  question_count: number;
  correct_count: number;
  score: number;
};

export type KnowledgeCheckData =
  | KnowledgeResult
  | {
      attempted: false;
      title: string;
      questions: KnowledgeQuestion[];
    };

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected Knowledge Check error occurred.";
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseResult(value: unknown): KnowledgeResult {
  if (
    !isRecord(value) ||
    value.attempted !== true ||
    typeof value.question_count !== "number" ||
    typeof value.correct_count !== "number" ||
    typeof value.score !== "number"
  ) {
    throw new Error("Invalid grading response.");
  }

  return {
    attempted: true,
    question_count: value.question_count,
    correct_count: value.correct_count,
    score: value.score,
  };
}

export async function loadKnowledgeCheckAction(
  lessonId: string
): Promise<ActionResult<KnowledgeCheckData>> {
  await requireAccount("learner");

  try {
    if (!UUID.test(lessonId)) {
      throw new Error("Invalid lesson ID.");
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "get_published_knowledge_check",
      { p_lesson_id: lessonId }
    );

    if (error) throw new Error(error.message);

    if (!isRecord(data)) {
      throw new Error("Invalid Knowledge Check response.");
    }

    if (data.attempted === true) {
      return {
        ok: true,
        data: parseResult(data),
      };
    }

    if (
      data.attempted !== false ||
      !Array.isArray(data.questions)
    ) {
      throw new Error("No valid questions were returned.");
    }

    const questions: KnowledgeQuestion[] =
      data.questions.map((raw) => {
        if (!isRecord(raw)) {
          throw new Error("Invalid question format.");
        }

        if (
          !Number.isInteger(raw.id) ||
          typeof raw.prompt !== "string" ||
          !Array.isArray(raw.options) ||
          !raw.options.every(
            (option) => typeof option === "string"
          )
        ) {
          throw new Error("Invalid question data.");
        }

        return {
          id: raw.id as number,
          prompt: raw.prompt,
          options: raw.options as string[],
        };
      });

    if (questions.length < 3 || questions.length > 5) {
      throw new Error("Knowledge Check is incomplete.");
    }

    return {
      ok: true,
      data: {
        attempted: false,
        title:
          typeof data.title === "string"
            ? data.title
            : "Knowledge Check",
        questions,
      },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function submitKnowledgeCheckAction(
  lessonId: string,
  answers: string[]
): Promise<ActionResult<KnowledgeResult>> {
  await requireAccount("learner");

  try {
    if (!UUID.test(lessonId)) {
      throw new Error("Invalid lesson ID.");
    }

    if (
      !Array.isArray(answers) ||
      answers.length < 3 ||
      answers.length > 5 ||
      answers.some(
        (answer) =>
          typeof answer !== "string" ||
          !answer.trim() ||
          answer.length > 1000
      )
    ) {
      throw new Error("Answer every question before submitting.");
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "submit_published_knowledge_check",
      {
        p_lesson_id: lessonId,
        p_answers: answers,
      }
    );

    if (error) throw new Error(error.message);

    return {
      ok: true,
      data: parseResult(data),
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
