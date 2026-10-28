
"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type EditorRecordType =
  | "vocabulary"
  | "step"
  | "activity"
  | "assessment";

export type EditorSaveInput = {
  lessonId: string;
  recordId: string;
  recordType: EditorRecordType;
  payload: Record<string, unknown>;
  expectedVersion?: string | null;
  confirmRevision?: boolean;
};

type SaveResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const allowed = new Set<EditorRecordType>([
  "vocabulary",
  "step",
  "activity",
  "assessment",
]);

export async function saveLessonEditorAction(
  input: EditorSaveInput
): Promise<SaveResult> {
  await requireAccount("admin");

  try {
    if (
      !input ||
      typeof input.lessonId !== "string" ||
      typeof input.recordId !== "string" ||
      !UUID.test(input.lessonId) ||
      !UUID.test(input.recordId) ||
      !allowed.has(input.recordType)
    ) {
      throw new Error("Invalid lesson editor request.");
    }

    if (
      !input.payload ||
      typeof input.payload !== "object" ||
      Array.isArray(input.payload)
    ) {
      throw new Error("Invalid content payload.");
    }

    const serialized = JSON.stringify(input.payload);

    // Bound the request size before calling the database.
    if (serialized.length > 100_000) {
      throw new Error("Content exceeds the editor size limit.");
    }

    const supabase = await createClient();

    const [snapshot, approval] = await Promise.all([
      supabase.from("published_lesson_snapshots").select("lesson_id").eq("lesson_id", input.lessonId).maybeSingle(),
      supabase.from("lesson_approvals").select("lesson_id").eq("lesson_id", input.lessonId).maybeSingle(),
    ]);
    if (snapshot.error || approval.error) throw new Error("Unable to verify revision status.");
    if ((snapshot.data || approval.data) && input.confirmRevision !== true) throw new Error("Confirm this draft revision before saving. It requires fresh approval and does not update the published snapshot.");
    if (input.expectedVersion && !/^[a-f0-9]{32}$/.test(input.expectedVersion)) throw new Error("Invalid source version.");
    const { data, error } = input.expectedVersion
      ? await supabase.rpc("apply_lesson_studio_changes", {
        p_lesson_id: input.lessonId, p_expected_version: input.expectedVersion,
        p_changes: [{ record_type: input.recordType, record_id: input.recordId, payload: input.payload }],
        p_confirm_revision: input.confirmRevision === true,
      })
      : await supabase.rpc("edit_lesson_content", {
        p_lesson_id: input.lessonId,
        p_record_type: input.recordType,
        p_record_id: input.recordId,
        p_payload: input.payload,
      });

    if (error) {
      throw new Error(error.message);
    }

    if (
      !data ||
      typeof data !== "object" ||
      data.saved !== true
    ) {
      throw new Error("Supabase did not confirm the save.");
    }

    revalidatePath("/admin/curriculum/lesson-editor");
    revalidatePath("/admin/curriculum/review");
    revalidatePath("/admin/curriculum/approve");
    revalidatePath("/admin/curriculum/lesson-preview");

    return {
      ok: true,
      message:
        "Content saved to Supabase. " +
        "Run the readiness checker and review again before approval.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to save lesson content.",
    };
  }
}
