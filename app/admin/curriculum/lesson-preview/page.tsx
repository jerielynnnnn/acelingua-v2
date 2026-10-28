import AdminWorkflowNavigation from "@/components/admin/AdminWorkflowNavigation";

import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import LessonExperiencePreview, {
  type PreviewStep,
} from "@/components/learn/LessonExperiencePreview";

import { requireAccount } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{
    lesson?: string;
  }>;
};

  const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Json = Record<string, unknown>;

function object(value: unknown): Json {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Json)
    : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string" &&
      item.trim().length > 0
  );
}

type Pair = {
  phrase: string;
  meaning: string;
};

function parsePairs(
  rawContent: unknown,
  rawAnswer: unknown
): Pair[] {
  const content = object(rawContent);
  const answer = object(rawAnswer);

  // Legacy format:
  // answer_config.pairs = [{left, right}]
  //
  // AI format:
  // content.pairs = [{phrase, meaning}]

  const sources = [answer.pairs, content.pairs];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;

    const pairs = source.map((raw) => {
      const row = object(raw);

      return {
        phrase: str(row.phrase ?? row.left),
        meaning: str(row.meaning ?? row.right),
      };
    });

    if (
      pairs.length >= 2 &&
      pairs.every((item) => item.phrase && item.meaning)
    ) {
      return pairs;
    }
  }

  return [];
}

function parseCards(value: unknown) {
  const content = object(value);

  if (!Array.isArray(content.cards)) return [];

  return content.cards.flatMap((raw) => {
    const card = object(raw);
    const front = str(card.front);
    const back = str(card.back);

    return front && back
      ? [{ front, back }]
      : [];
  });
}

function uniqueValues(values: string[]): boolean {
  return (
    values.length ===
    new Set(
      values.map((value) => value.toLocaleLowerCase())
    ).size
  );
}

function validOptions(
  options: string[],
  answer: string
): boolean {
  return (
    options.length >= 2 &&
    options.every((item) => item.trim().length > 0) &&
    uniqueValues(options) &&
    options.includes(answer)
  );
}

async function Content({ searchParams }: Props) {
  await connection();
  await requireAccount("admin");

  const params = await searchParams;
  const lessonId = params.lesson;

  if (!lessonId || !UUID.test(lessonId)) {
    return (
      <main className="flex min-h-0 flex-col items-center justify-center gap-4 bg-[#f9f2ff] p-8 text-[#2A255C]">
        <h1 className="text-2xl font-extrabold">
          Select a Lesson
        </h1>

        <Link
          href="/admin/curriculum/review"
          className="rounded-xl bg-[#3558AE] px-5 py-3 text-sm font-bold text-white"
        >
          Open Curriculum Review
        </Link>
      </main>
    );
  }

  const supabase = await createClient();

  const { data: lesson, error: lessonError } =
    await supabase
      .from("lessons")
      .select("id, unit_id, title, status")
      .eq("id", lessonId)
      .single();

  if (lessonError || !lesson) {
    throw new Error(
      lessonError?.message || "Lesson not found."
    );
  }

  const { data: unit, error: unitError } =
    await supabase
      .from("units")
      .select("id, course_id, status")
      .eq("id", lesson.unit_id)
      .single();

  if (unitError || !unit) {
    throw new Error(
      unitError?.message || "Unit not found."
    );
  }

  const { data: course, error: courseError } =
    await supabase
      .from("courses")
      .select("title, status")
      .eq("id", unit.course_id)
      .single();

  if (courseError || !course) {
    throw new Error(
      courseError?.message || "Course not found."
    );
  }

  // This route is Admin-only and currently previews
  // draft content.
  if (
    lesson.status !== "draft" ||
    unit.status !== "draft" ||
    course.status !== "draft"
  ) {
    return (
      <main className="min-h-0 bg-[#f9f2ff] p-10 text-center text-[#2A255C]">
        <h1 className="text-2xl font-extrabold">
          Draft Preview Unavailable
        </h1>
        <p className="mt-4 text-sm text-slate-600">
          This preview supports draft curriculum only.
        </p>
      </main>
    );
  }

  const [
    lessonStepsResult,
    activitiesResult,
    assessmentResult,
  ] = await Promise.all([
    supabase
      .from("lesson_steps")
      .select(
        "id, step_number, step_type, title, content"
      )
      .eq("lesson_id", lesson.id)
      .eq("status", "draft")
      .order("step_number"),

    supabase
      .from("lesson_activities")
      .select(
        "id, activity_number, activity_type, title, instructions, content, answer_config"
      )
      .eq("lesson_id", lesson.id)
      .eq("status", "draft")
      .order("activity_number"),

    supabase
      .from("ai_assessment_drafts")
      .select("id, title, questions, status")
      .eq("lesson_id", lesson.id)
      .maybeSingle(),
  ]);

  for (const result of [
    lessonStepsResult,
    activitiesResult,
    assessmentResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  // ------------------------------------------------
  // PART 1: EXISTING TEACHING STEPS
  // ------------------------------------------------

  const teachingSteps: PreviewStep[] =
    (lessonStepsResult.data ?? []).map((step) => ({
      id: step.id,
      step_number: step.step_number,
      step_type: step.step_type,
      title: step.title,
      content: object(step.content),
    }));

  // ------------------------------------------------
  // PART 2: EXISTING INTERACTIVE ACTIVITIES
  // ------------------------------------------------

  const activitySteps: PreviewStep[] = [];

  for (const activity of activitiesResult.data ?? []) {
    const content = object(activity.content);
    const answer = object(activity.answer_config);

    // FLASHCARDS
    if (activity.activity_type === "flip_cards") {
      const cards = parseCards(activity.content);

      if (cards.length < 2) continue;

      activitySteps.push({
        id: `activity-${activity.id}`,
        step_number: activity.activity_number,
        step_type: "flip_cards",
        title: activity.title,
        content: {
          cards,
          instructions: activity.instructions ?? "",
        },
      });

      continue;
    }

    // MATCHING
    if (activity.activity_type === "matching") {
      const pairs = parsePairs(
        activity.content,
        activity.answer_config
      );

      if (pairs.length < 2) continue;

      const phrases = pairs.map((item) => item.phrase);
      const meanings = pairs.map((item) => item.meaning);

      if (
        !uniqueValues(phrases) ||
        !uniqueValues(meanings)
      ) {
        continue;
      }

      // Validate legacy leftItems/rightItems if present.
      const leftItems = stringArray(content.leftItems);
      const rightItems = stringArray(content.rightItems);

      if (
        content.leftItems !== undefined ||
        content.rightItems !== undefined
      ) {
        if (
          leftItems.length !== pairs.length ||
          rightItems.length !== pairs.length ||
          !phrases.every((item) =>
            leftItems.includes(item)
          ) ||
          !meanings.every((item) =>
            rightItems.includes(item)
          )
        ) {
          continue;
        }
      }

      activitySteps.push({
        id: `activity-${activity.id}`,
        step_number: activity.activity_number,
        step_type: "matching",
        title: activity.title,
        content: {
          pairs,
          instructions: activity.instructions ?? "",
        },
      });

      continue;
    }

    // MULTIPLE CHOICE
    if (activity.activity_type === "multiple_choice") {
      const options = stringArray(content.options);

      const correctAnswer = str(
        answer.correct_answer ?? answer.answer
      );

      if (!validOptions(options, correctAnswer)) {
        continue;
      }

      activitySteps.push({
        id: `activity-${activity.id}`,
        step_number: activity.activity_number,
        step_type: "multiple_choice",
        title: activity.title,
        content: {
          prompt:
            str(content.prompt) ||
            str(content.question) ||
            str(content.question_text) ||
            "Choose the correct answer for this vocabulary activity.",
          options,
          correct_answer: correctAnswer,
          explanation: str(
            content.explanation ?? answer.explanation
          ),
        },
      });

      continue;
    }

    // WORD ORDER (newer AI format)
    if (activity.activity_type === "word_order") {
      const sentence = str(
        answer.correct_answer ??
        answer.answer ??
        content.sentence
      );

      if (
        sentence.split(/\s+/).filter(Boolean).length < 2
      ) {
        continue;
      }

      activitySteps.push({
        id: `activity-${activity.id}`,
        step_number: activity.activity_number,
        step_type: "word_order",
        title: activity.title,
        content: {
          prompt:
            str(content.prompt) ||
            "Arrange the words into a sentence.",
          sentence,
        },
      });
    }
  }

  // ------------------------------------------------
  // PART 3: KNOWLEDGE CHECK
  // ------------------------------------------------

  const assessmentSteps: PreviewStep[] = [];

  const assessment = assessmentResult.data;

  if (
    assessment &&
    Array.isArray(assessment.questions) &&
    assessment.questions.length >= 3 &&
    assessment.questions.length <= 5
  ) {
    assessment.questions.forEach((raw, index) => {
      const question = object(raw);

      const options = stringArray(question.options);
      const correctAnswer =
        str(question.correct_answer);
      const prompt = str(question.prompt);
      const explanation = str(question.explanation);

      if (
        !prompt ||
        !explanation ||
        options.length !== 3 ||
        !validOptions(options, correctAnswer)
      ) {
        return;
      }

      assessmentSteps.push({
        id: `assessment-${assessment.id}-${index}`,
        step_number: index + 1,
        step_type: "assessment_question",
        title: `Question ${index + 1}`,
        content: {
          prompt,
          options,
          correct_answer: correctAnswer,
          explanation,
        },
      });
    });
  }

  // ------------------------------------------------
  // PART 4: ASSEMBLE COMPLETE EXPERIENCE
  // ------------------------------------------------

  const introduction = teachingSteps.filter(
    (step) => step.step_type === "introduction"
  );

  const summary = teachingSteps.filter(
    (step) => step.step_type === "summary"
  );

  const learning = teachingSteps.filter(
    (step) =>
      step.step_type !== "introduction" &&
      step.step_type !== "summary"
  );

  const orderedLearning = [
    ...introduction,
    ...learning,
  ].sort((a, b) => a.step_number - b.step_number);

  const orderedActivities = [...activitySteps].sort(
    (a, b) => a.step_number - b.step_number
  );

  const combinedSteps: PreviewStep[] = [
    ...orderedLearning,
    ...orderedActivities,
    ...summary,
    ...assessmentSteps,
    {
      id: `completion-${lesson.id}`,
      step_number: 9999,
      step_type: "completion",
      title: "Your Learning Results",
      content: {},
    },
  ];

  // Avoid showing only a completion screen if no
  // teaching or activity content exists.
  if (
    orderedLearning.length === 0 &&
    orderedActivities.length === 0 &&
    assessmentSteps.length === 0
  ) {
    return (
      <main className="flex min-h-0 flex-col items-center justify-center gap-4 bg-[#f9f2ff] p-8 text-[#2A255C]">
        <h1 className="text-2xl font-extrabold">
          No Playable Content Yet
        </h1>

        <p className="text-sm text-slate-600">
          Generate and review the lesson content first.
        </p>

        <Link
          href={
            "/admin/curriculum/lesson-ai?lesson=" +
            encodeURIComponent(lesson.id)
          }
          className="rounded-xl bg-[#3558AE] px-5 py-3 text-sm font-bold text-white"
        >
          Open AI Lesson Studio
        </Link>
      </main>
    );
  }

  return (
    <>
    <AdminWorkflowNavigation slug="lesson-preview" lesson={lesson.id} />
    <LessonExperiencePreview
      key={lesson.id}
      lessonId={lesson.id}
      lessonTitle={lesson.title}
      courseTitle={course.title}
      steps={combinedSteps}
    />
    </>
  );
}

export default function LessonPreviewPage(
  props: Props
) {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-0 items-center justify-center bg-[#f9f2ff] text-[#3558AE]"
        >
          Loading complete learner preview...
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
