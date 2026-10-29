
"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type LearnerRoadmapLesson = {
  lessonId: string;
  courseId: string;
  unitId: string;
  courseTitle: string;
  unitTitle: string;
  lessonTitle: string;
  unitNumber: number;
  lessonNumber: number;
  publishedAt: string;
  completed: boolean;
  unlocked: boolean;
  score: number | null;
  completedAt: string | null;
  xpAwarded: number | null;
  coinsAwarded: number | null;
};

export type LearnerLearningState = {
  lessons: LearnerRoadmapLesson[];
  xp: number;
  coins: number;
};

export type LessonCompletionResult = {
  completed: true;
  alreadyCompleted: boolean;
  score: number;
  xpAwarded: number;
  coinsAwarded: number;
  completedAt: string;
};

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  throw new Error("Invalid response from the database.");
}

function string(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Invalid text field in progress data.");
  }
  return value;
}

function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Invalid number in progress data.");
  }
  return value;
}

function nullableNumber(value: unknown): number | null {
  return value === null ? null : number(value);
}

function nullableString(value: unknown): string | null {
  return value === null ? null : string(value);
}

function parseLesson(value: unknown): LearnerRoadmapLesson {
  const item = record(value);

  if (
    typeof item.completed !== "boolean" ||
    typeof item.unlocked !== "boolean"
  ) {
    throw new Error("Invalid lesson completion state.");
  }

  return {
    lessonId: string(item.lessonId),
    courseId: string(item.courseId),
    unitId: string(item.unitId),
    courseTitle: string(item.courseTitle),
    unitTitle: string(item.unitTitle),
    lessonTitle: string(item.lessonTitle),
    unitNumber: number(item.unitNumber),
    lessonNumber: number(item.lessonNumber),
    publishedAt: string(item.publishedAt),
    completed: item.completed,
    unlocked: item.unlocked,
    score: nullableNumber(item.score),
    completedAt: nullableString(item.completedAt),
    xpAwarded: nullableNumber(item.xpAwarded),
    coinsAwarded: nullableNumber(item.coinsAwarded),
  };
}

function parseState(value: unknown): LearnerLearningState {
  const item = record(value);

  if (!Array.isArray(item.lessons)) {
    throw new Error("Missing learner roadmap data.");
  }

  return {
    lessons: item.lessons.map(parseLesson),
    xp: number(item.xp),
    coins: number(item.coins),
  };
}

function parseCompletion(
  value: unknown
): LessonCompletionResult {
  const item = record(value);

  if (
    item.completed !== true ||
    typeof item.already_completed !== "boolean"
  ) {
    throw new Error("Invalid completion confirmation.");
  }

  return {
    completed: true,
    alreadyCompleted: item.already_completed,
    score: number(item.score),
    xpAwarded: number(item.xp_awarded),
    coinsAwarded: number(item.coins_awarded),
    completedAt: string(item.completed_at),
  };
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to update learner progress.";
}

export async function getLearnerLearningStateAction(): Promise<
  ActionResult<LearnerLearningState>
> {
  await requireAccount("learner");

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "get_learner_learning_state"
    );

    if (error) {
      if (error.code === "PGRST202" || error.code === "42883") {
        throw new Error(
          "Learner progress is not configured in this database. " +
          "Apply migration 20261029020000_restore_learner_learning_state.sql " +
          "and reload the Supabase schema cache."
        );
      }
      throw new Error(error.message);
    }

    return {
      ok: true,
      data: parseState(data),
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export async function completeLearnerLessonAction(
  lessonId: string
): Promise<ActionResult<LessonCompletionResult>> {
  await requireAccount("learner");

  try {
    if (!UUID.test(lessonId)) {
      throw new Error("Invalid lesson ID.");
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "complete_learner_lesson",
      { p_lesson_id: lessonId }
    );

    if (error) throw new Error(error.message);

    const completion = parseCompletion(data);

    revalidatePath("/dashboard");
    revalidatePath("/learn/published");
    revalidatePath(
      `/learn/published/${encodeURIComponent(lessonId)}`
    );

    return {
      ok: true,
      data: completion,
    };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}
