
"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { getLessonReadiness } from "@/lib/curriculum/readiness";

type PublishResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

export type PublishingStatus = {
  approvalStatus:
    | "not_approved"
    | "approved"
    | "needs_reapproval";
  publicationStatus:
    | "not_published"
    | "published"
    | "withdrawn";
  publishedAt: string | null;
};

type StatusResult =
  | { ok: true; data: PublishingStatus }
  | { ok: false; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validId(value: string) {
  return UUID.test(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unexpected publishing error.";
}

function refresh(lessonId: string) {
  revalidatePath("/admin/curriculum/publish");
  revalidatePath("/admin/curriculum/review");
  revalidatePath("/admin/curriculum/approve");
  revalidatePath("/learn/published");
  revalidatePath(
    `/learn/published/${encodeURIComponent(lessonId)}`
  );
}

export async function getPublishingStatusAction(
  lessonId: string
): Promise<StatusResult> {
  await requireAccount("admin");

  try {
    if (!validId(lessonId)) {
      throw new Error("Invalid lesson ID.");
    }

    const supabase = await createClient();

    const [approval, snapshot] = await Promise.all([
      supabase.rpc("get_lesson_approval_status", {
        p_lesson_id: lessonId,
      }),

      supabase
        .from("published_lesson_snapshots")
        .select("status, published_at")
        .eq("lesson_id", lessonId)
        .maybeSingle(),
    ]);

    if (approval.error) {
      throw new Error(approval.error.message);
    }

    if (snapshot.error) {
      throw new Error(snapshot.error.message);
    }

    const rawApproval = approval.data as {
      status?: string;
    } | null;

    const approvalStatus =
      rawApproval?.status === "approved" ||
      rawApproval?.status === "needs_reapproval"
        ? rawApproval.status
        : "not_approved";

    const publicationStatus =
      snapshot.data?.status === "published" ||
      snapshot.data?.status === "withdrawn"
        ? snapshot.data.status
        : "not_published";

    return {
      ok: true,
      data: {
        approvalStatus,
        publicationStatus,
        publishedAt:
          snapshot.data?.published_at ?? null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
    };
  }
}

export async function publishLessonAction(
  lessonId: string
): Promise<PublishResult> {
  await requireAccount("admin");

  try {
    if (!validId(lessonId)) {
      throw new Error("Invalid lesson ID.");
    }

    const report = await getLessonReadiness(lessonId);

    if (!report.ready) {
      const failures = report.checks
        .filter((check) => check.status === "fail")
        .map((check) => check.label);

      throw new Error(
        "Resolve readiness issues first: " +
        failures.join(", ")
      );
    }

    const missingPrompt = report.checks.some(
      (check) =>
        check.id === "multiple-choice-prompt" &&
        check.status !== "pass"
    );

    if (missingPrompt) {
      throw new Error(
        "Correct the missing multiple-choice question prompt first."
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "publish_approved_lesson",
      {
        p_lesson_id: lessonId,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.published !== true) {
      throw new Error("Publication was not confirmed.");
    }

    refresh(lessonId);

    return {
      ok: true,
      message:
        "Lesson snapshot published. Teaching content " +
        "is now available to authenticated learners.",
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
    };
  }
}

export async function withdrawLessonAction(
  lessonId: string
): Promise<PublishResult> {
  await requireAccount("admin");

  try {
    if (!validId(lessonId)) {
      throw new Error("Invalid lesson ID.");
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "withdraw_published_lesson",
      {
        p_lesson_id: lessonId,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.withdrawn !== true) {
      throw new Error("Withdrawal was not confirmed.");
    }

    refresh(lessonId);

    return {
      ok: true,
      message:
        "The lesson was withdrawn. It is no longer " +
        "available through the learner publishing policy.",
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
    };
  }
}
