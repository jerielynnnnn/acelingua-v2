import { validateOutline } from "./ai-outline";

export const courseLanguages = [
  { code: "ja", country: "jp", name: "Japanese", nativeName: "日本語" },
  { code: "ko", country: "kr", name: "Korean", nativeName: "한국어" },
  { code: "it", country: "it", name: "Italian", nativeName: "Italiano" },
  { code: "es", country: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", country: "fr", name: "French", nativeName: "Français" },
  { code: "de", country: "de", name: "German", nativeName: "Deutsch" },
  { code: "zh", country: "cn", name: "Chinese", nativeName: "中文" },
  { code: "th", country: "th", name: "Thai", nativeName: "ไทย" },
  { code: "fil", country: "ph", name: "Filipino", nativeName: "Filipino" },
  { code: "en", country: "gb", name: "English", nativeName: "English" },
] as const;
export type CourseLanguage = typeof courseLanguages[number];
export type CourseDraft = { title: string; description: string; units: {
  title: string; description: string; lessons: {
    title: string; description: string; learning_objective: string;
    difficulty: "beginner"; lesson_type: "standard" | "conversation" | "review";
  }[];
}[] };

export function selectedLanguage(code: unknown): CourseLanguage {
  const language = courseLanguages.find(item => item.code === code);
  if (!language) throw new Error("Choose a supported language.");
  return language;
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
    throw new Error("The course contains invalid or unexpected fields.");
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} must contain 1–${max} characters.`);
  return value.trim();
}
export function validateCourseDraft(input: unknown): CourseDraft {
  const root = object(input, ["title", "description", "units"]);
  if (!Array.isArray(root.units) || root.units.length !== 3) throw new Error("A course must contain exactly 3 units.");
  const draft: CourseDraft = {
    title: text(root.title, "Course title", 150), description: text(root.description, "Course description", 3000),
    units: root.units.map(raw => {
      const unit = object(raw, ["title", "description", "lessons"]);
      if (!Array.isArray(unit.lessons) || unit.lessons.length !== 3) throw new Error("Each unit must contain exactly 3 lessons.");
      return { title: text(unit.title, "Unit title", 150), description: text(unit.description, "Unit description", 3000), lessons: unit.lessons.map(rawLesson => {
        const lesson = object(rawLesson, ["title", "description", "learning_objective", "difficulty", "lesson_type"]);
        if (lesson.difficulty !== "beginner" || !["standard", "conversation", "review"].includes(String(lesson.lesson_type))) throw new Error("Choose a beginner lesson with a supported lesson type.");
        return { title: text(lesson.title, "Lesson title", 150), description: text(lesson.description, "Lesson description", 2000), learning_objective: text(lesson.learning_objective, "Learning objective", 700), difficulty: "beginner" as const, lesson_type: lesson.lesson_type as CourseDraft["units"][number]["lessons"][number]["lesson_type"] };
      }) };
    }),
  };
  // Reuse the existing outline rules, including duplicate title detection.
  validateOutline(courseOutline(draft));
  return draft;
}
export function courseOutline(draft: CourseDraft) {
  return { units: draft.units.map(unit => ({ ...unit, lessons: unit.lessons.map(lesson => ({ title: lesson.title, lesson_type: lesson.lesson_type, description: `${lesson.description}\n\nLearning objective: ${lesson.learning_objective}\nSuggested difficulty: beginner (A1).` })) })) };
}
const string = (maxLength: number) => ({ type: "string", minLength: 1, maxLength });
const lessonProperties = { title: string(150), description: string(2000), learning_objective: string(700), difficulty: { type: "string", enum: ["beginner"] }, lesson_type: { type: "string", enum: ["standard", "conversation", "review"] } };
const unitProperties = { title: string(150), description: string(3000), lessons: { type: "array", minItems: 3, maxItems: 3, items: { type: "object", additionalProperties: false, required: Object.keys(lessonProperties), properties: lessonProperties } } };
export const courseDraftSchema = { type: "object", additionalProperties: false, required: ["title", "description", "units"], properties: { title: string(150), description: string(3000), units: { type: "array", minItems: 3, maxItems: 3, items: { type: "object", additionalProperties: false, required: Object.keys(unitProperties), properties: unitProperties } } } };
