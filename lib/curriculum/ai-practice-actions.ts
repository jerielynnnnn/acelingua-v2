
"use server";

import { revalidatePath } from "next/cache";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type PracticeResult =
  | {
      ok: true;
      data: {
        created_activities: number;
        skipped_activities: number;
      };
    }
  | {
      ok: false;
      error: string;
    };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generatePracticeAction(
  lessonId: string
): Promise<PracticeResult> {
  await requireAccount("admin");

  try {
    if (
      typeof lessonId !== "string" ||
      !uuidPattern.test(lessonId)
    ) {
      throw new Error("Please select a valid lesson.");
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "generate_lesson_practice",
      {
        p_lesson_id: lessonId,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (
      !data ||
      typeof data.created_activities !== "number" ||
      typeof data.skipped_activities !== "number"
    ) {
      throw new Error(
        "Unexpected activity generation response."
      );
    }

    revalidatePath("/admin");
    revalidatePath("/admin/curriculum");
    revalidatePath("/admin/curriculum/activities");
    revalidatePath("/admin/curriculum/practice-ai");

    return {
      ok: true,
      data: {
        created_activities: data.created_activities,
        skipped_activities: data.skipped_activities,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to generate practice activities.",
    };
  }
}
