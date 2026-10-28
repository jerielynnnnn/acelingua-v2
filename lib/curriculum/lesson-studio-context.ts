import "server-only";
import { createClient } from "@/lib/supabase/server";
import { validLessonId } from "@/lib/admin/navigation";
import { object } from "./lesson-studio";
const locales: Record<string, string> = { ja: "ja-JP", jp: "ja-JP", ko: "ko-KR", kr: "ko-KR", fr: "fr-FR", th: "th-TH", es: "es-ES", en: "en-US", de: "de-DE", it: "it-IT", zh: "zh-CN", fil: "fil-PH" };
// Caller must authorize the administrator before requesting private draft content.
export async function loadStudioContext(lessonId: string) {
  if (!validLessonId(lessonId))
    throw new Error("Select a valid lesson.");
  const db = await createClient();
  const lessonResult = await db.from("lessons").select("id, title, description, unit_id, lesson_number, status").eq("id", lessonId).single();
  if (lessonResult.error)
    throw new Error(lessonResult.error.message);
  const lesson = lessonResult.data;
  const unitResult = await db.from("units").select("id, title, course_id, unit_number, status").eq("id", lesson.unit_id).single();
  if (unitResult.error)
    throw new Error(unitResult.error.message);
  const unit = unitResult.data;
  const courseResult = await db.from("courses").select("id, title, difficulty, language_id, status").eq("id", unit.course_id).single();
  if (courseResult.error)
    throw new Error(courseResult.error.message);
  const course = courseResult.data;
  const version = await db.rpc("get_lesson_studio_version", { p_lesson_id: lessonId });
  const [language, vocabulary, steps, activities, assessment, snapshot, approval, courseUnits] = await Promise.all([
    db.from("languages").select("name, code").eq("id", course.language_id).single(),
    db.from("lesson_vocabulary").select("id, lesson_id, vocabulary_number, phrase, romanization, meaning, usage_note, language_locale, status").eq("lesson_id", lessonId).neq("status", "archived").order("vocabulary_number"),
    db.from("lesson_steps").select("id, step_number, step_type, title, content, status").eq("lesson_id", lessonId).neq("status", "archived").order("step_number"),
    db.from("lesson_activities").select("id, activity_number, activity_type, title, instructions, content, answer_config, status").eq("lesson_id", lessonId).neq("status", "archived").order("activity_number"),
    db.from("ai_assessment_drafts").select("id, title, questions, status").eq("lesson_id", lessonId).maybeSingle(),
    db.from("published_lesson_snapshots").select("lesson_title, course_title, unit_title, learning_content, status, published_at").eq("lesson_id", lessonId).maybeSingle(),
    db.rpc("get_lesson_approval_status", { p_lesson_id: lessonId }),
    db.from("units").select("id, unit_number").eq("course_id", course.id).neq("status", "archived").limit(1000),
  ]);
  // Version is optional until the additive safe-apply function is deployed. Existing editing stays available.
  for (const result of [language, vocabulary, steps, activities, assessment, snapshot, approval, courseUnits])
    if (result.error)
      throw new Error(result.error.message);
  const locale = locales[language.data!.code.toLowerCase()];
  if (!locale)
    throw new Error("This language does not have a configured speech locale.");
  const earlierUnits = courseUnits.data!.filter(parent => parent.unit_number <= unit.unit_number);
  if (courseUnits.data!.length >= 1000)
    throw new Error("Course exceeds the safe context limit.");
  const priorLessonsResult = await db.from("lessons").select("id, title, lesson_number, unit_id").in("unit_id", earlierUnits.map(parent => parent.id)).neq("status", "archived").limit(1000);
  if (priorLessonsResult.error)
    throw new Error(priorLessonsResult.error.message);
  if (priorLessonsResult.data.length >= 1000)
    throw new Error("Course exceeds the safe lesson context limit.");
  const previousLessons = priorLessonsResult.data.filter(item => {
    const parent = earlierUnits.find(parent => parent.id === item.unit_id);
    return parent && (parent.unit_number < unit.unit_number || (parent.id === unit.id && item.lesson_number < lesson.lesson_number));
  });
  let previousVocabulary: {
    id: string;
    lesson_id: string;
    phrase: string;
    meaning: string;
  }[] = [];
  if (previousLessons.length) {
    const previous = await db.from("lesson_vocabulary").select("id, lesson_id, phrase, meaning").in("lesson_id", previousLessons.map(item => item.id)).neq("status", "archived").limit(1000);
    if (previous.error)
      throw new Error(previous.error.message);
    if (previous.data.length >= 1000)
      throw new Error("Previous vocabulary exceeds the safe context limit.");
    previousVocabulary = previous.data;
  }
  if (!version.error) {
    const latest = await db.rpc("get_lesson_studio_version", { p_lesson_id: lessonId });
    if (latest.error || latest.data !== version.data)
      throw new Error("Lesson changed while loading. Reload this workspace.");
  }
  return {
    lesson, unit, course, language: language.data!, locale,
    vocabulary: vocabulary.data ?? [], steps: (steps.data ?? []).map(item => ({ ...item, content: object(item.content) })),
    activities: (activities.data ?? []).map(item => ({ ...item, content: object(item.content), answer_config: object(item.answer_config) })),
    assessment: assessment.data, snapshot: snapshot.data, approval: object(approval.data),
    version: version.error || typeof version.data !== "string" ? null : version.data,
    previousVocabulary, previousLessons,
    editable: [lesson.status, unit.status, course.status].every(status => status === "draft"),
  };
}
export type StudioContext = Awaited<ReturnType<typeof loadStudioContext>>;
