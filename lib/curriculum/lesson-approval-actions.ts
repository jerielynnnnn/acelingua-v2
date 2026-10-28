
"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { getLessonReadiness } from "@/lib/curriculum/readiness";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ApprovalStatus =
  | "not_approved"
  | "approved"
  | "needs_reapproval";

export type ApprovalState = {
  status: ApprovalStatus;
  approved_at?: string;
  review_notes?: string;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function getMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

export async function loadLessonApprovalAction(
  lessonId: string
): Promise<Result<ApprovalState>> {
  await requireAccount("admin");

  try {
    if (!UUID.test(lessonId)) {
      throw new Error("Invalid lesson ID.");
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "get_lesson_approval_status",
      { p_lesson_id: lessonId }
    );

    if (error) throw new Error(error.message);

    if (
      !data ||
      typeof data !== "object" ||
      !["not_approved", "approved", "needs_reapproval"]
        .includes(data.status)
    ) {
      throw new Error("Unexpected approval status.");
    }

    return {
      ok: true,
      data: {
        status: data.status as ApprovalStatus,
        approved_at:
          typeof data.approved_at === "string"
            ? data.approved_at
            : undefined,
        review_notes:
          typeof data.review_notes === "string"
            ? data.review_notes
            : undefined,
      },
    };
  } catch (error) {
    return { ok: false, error: getMessage(error) };
  }
}

export async function approveLessonAction(input: {
  lessonId: string;
  reviewNotes: string;
}): Promise<
  Result<{ approved_at: string; approved: boolean }>
> {
  await requireAccount("admin");

  try {
    if (!input || !UUID.test(input.lessonId)) {
      throw new Error("Invalid lesson ID.");
    }

    if (
      typeof input.reviewNotes !== "string" ||
      input.reviewNotes.length > 2000
    ) {
      throw new Error("Review notes must be under 2000 characters.");
    }

    const report = await getLessonReadiness(input.lessonId);

    if (!report.ready) {
      const problems = report.checks
        .filter((check) => check.status === "fail")
        .map((check) => check.label);

      throw new Error(
        "Fix the following readiness issues first: " +
        problems.join(", ")
      );
    }

    // Known issue: the existing Saying Hello multiple-choice
    // activity has no saved question prompt.
    // Block approval until the question is corrected.
    const missingPrompt = report.checks.find(
      (check) =>
        check.id === "multiple-choice-prompt" &&
        check.status !== "pass"
    );

    if (missingPrompt) {
      throw new Error(
        "A multiple-choice activity is missing its question " +
        "prompt. Correct it before final approval."
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "approve_lesson_content",
      {
        p_lesson_id: input.lessonId,
        p_review_notes: input.reviewNotes.trim(),
      }
    );

    if (error) throw new Error(error.message);

    if (
      !data ||
      typeof data.approved_at !== "string" ||
      data.approved !== true
    ) {
      throw new Error(
        "Supabase did not confirm lesson approval."
      );
    }

    revalidatePath("/admin/curriculum/review");
    revalidatePath("/admin/curriculum/approve");

    return {
      ok: true,
      data: {
        approved_at: data.approved_at,
        approved: true,
      },
    };
  } catch (error) {
    return { ok: false, error: getMessage(error) };
  }
}
