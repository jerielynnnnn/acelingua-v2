import type { SupabaseClient } from "@supabase/supabase-js";

export type CatalogLanguage = { id: string; code: string; name: string; native_name: string | null; flag_emoji: string | null };
export type CatalogCourse = { id: string; language_id: string; title: string; description: string | null; level: string | null;
  firstLessonId: string | null; publishedLessons: number; previewAvailable: boolean; playable: boolean; status: string | null;
  completedLessons: number | null };

/** Read only published curriculum. Guests use vocabulary already allowed by guest RLS. */
export async function loadLanguageCatalog(supabase: SupabaseClient, userId?: string) {
  const languages = await supabase.from("languages").select("id, code, name, native_name, flag_emoji").eq("is_active", true).order("name").order("id");
  if (languages.error) throw languages.error;
  const rows: CatalogLanguage[] = languages.data ?? [];
  const groups = await Promise.all(rows.map(async language => {
    const courses: CatalogCourse[] = [];
    const catalog = await supabase.from("courses").select("id, language_id, title, description, level")
      .eq("language_id", language.id).eq("is_published", true).order("created_at").order("id");
    if (catalog.error) throw catalog.error;
    for (const course of catalog.data ?? []) {
      const content = await publishedCourseAvailability(supabase, course.id, Boolean(userId));
      let status: string | null = null;
      let completedLessons: number | null = null;
      if (userId) {
        const enrollment = await supabase.from("user_courses").select("status").eq("user_id", userId).eq("course_id", course.id).maybeSingle();
        if (enrollment.error) throw enrollment.error;
        status = enrollment.data?.status ?? null;
        completedLessons = 0;
        for (let start = 0; start < content.lessonIds.length; start += 100) {
          const result = await supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId).eq("status", "completed")
            .in("lesson_id", content.lessonIds.slice(start, start + 100));
          if (result.error) throw result.error;
          completedLessons += new Set((result.data ?? []).map(row => row.lesson_id)).size;
        }
      }
      courses.push({ ...course, firstLessonId: content.firstLessonId, publishedLessons: content.lessonIds.length,
        previewAvailable: content.previewAvailable, playable: content.playable, status, completedLessons });
    }
    return courses;
  }));
  return { languages: rows, courses: groups.flat() };
}

export async function publishedCourseAvailability(supabase: SupabaseClient, courseId: string, authenticated: boolean) {
  const units = await supabase.from("units").select("id, unit_order").eq("course_id", courseId).eq("is_published", true).order("unit_order").order("id");
  if (units.error) throw units.error;
  const lessonIds: string[] = [];
  for (const unit of units.data ?? []) {
    // Paginate lessons so published totals cannot be silently truncated by the API.
    for (let offset = 0; ; offset += 500) {
      const lessons = await supabase.from("lessons").select("id").eq("unit_id", unit.id).eq("is_published", true)
        .order("lesson_order").order("id").range(offset, offset + 499);
      if (lessons.error) throw lessons.error;
      lessonIds.push(...(lessons.data ?? []).map(row => row.id));
      if ((lessons.data?.length ?? 0) < 500) break;
    }
  }
  const firstLessonId = lessonIds[0] ?? null;
  if (!firstLessonId) return { lessonIds, firstLessonId, previewAvailable: false, playable: false };
  const vocabulary = await supabase.from("vocabulary").select("id", { count: "exact", head: true }).eq("lesson_id", firstLessonId);
  if (vocabulary.error) throw vocabulary.error;
  const previewAvailable = (vocabulary.count ?? 0) > 0;
  let playable = previewAvailable;
  if (authenticated) {
    const activities = await supabase.from("activities").select("id").eq("lesson_id", firstLessonId);
    if (activities.error) throw activities.error;
    // Phase 1 reflects the current player's vocabulary-first requirement.
    // Extend this check together with the player when adding new engines.
    const activityRows = activities.data ?? [];
    if (activityRows.length) {
      const questions = await supabase.from("questions").select("question_type, correct_answer, options").in("activity_id", activityRows.map(a => a.id));
      if (questions.error) throw questions.error;
      const supported = (questions.data ?? []).every(q => q.question_type === "translation" ? Boolean(q.correct_answer?.trim())
        : ["multiple_choice", "true_false"].includes(q.question_type) && Array.isArray(q.options) && q.options.length >= 2
          && q.options.every((choice: unknown) => typeof choice === "string") && q.options.includes(q.correct_answer));
      playable = previewAvailable && supported && Boolean(questions.data?.length);
    }
  }
  return { lessonIds, firstLessonId, previewAvailable, playable };
}
