
import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CheckStatus = "pass" | "fail" | "warning";

export type ReadinessCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  details: string;
};

export type ReadinessReport = {
  lessonId: string;
  courseTitle: string;
  unitTitle: string;
  lessonTitle: string;
  lessonStatus: string;
  checks: ReadinessCheck[];
  counts: {
    vocabulary: number;
    steps: number;
    activities: number;
    assessments: number;
  };
  ready: boolean;
  errors: number;
  warnings: number;
};

type Json = Record<string, unknown>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function stringList(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        typeof entry === "string" &&
        entry.trim().length > 0
    )
  ) {
    return [];
  }

  return value.map((entry: string) => entry.trim());
}

function unique(items: string[]): boolean {
  return (
    new Set(items.map((item) => item.toLowerCase())).size ===
    items.length
  );
}

function validMultipleChoice(
  rawContent: unknown,
  rawAnswer: unknown
): {
  answersValid: boolean;
  hasPrompt: boolean;
} {
  const content = object(rawContent);
  const config = object(rawAnswer);

  const options = stringList(content.options);

  // New AI format: answer_config.correct_answer
  // Existing Activity Builder: answer_config.answer
  const answer = str(
    config.correct_answer ?? config.answer
  );

  const hasPrompt = Boolean(
    str(content.prompt) ||
    str(content.question) ||
    str(content.question_text)
  );

  return {
    answersValid:
      options.length >= 2 &&
      unique(options) &&
      options.includes(answer),
    hasPrompt,
  };
}

function matchingPairs(
  rawContent: unknown,
  rawAnswer: unknown
): Array<{ phrase: string; meaning: string }> {
  const content = object(rawContent);
  const config = object(rawAnswer);

  // Existing Activity Builder stores:
  // answer_config.pairs = [{ left, right }]
  //
  // New AI generator stores:
  // content.pairs = [{ phrase, meaning }]

  const sources = [config.pairs, content.pairs];

  for (const source of sources) {
    if (!Array.isArray(source) || source.length === 0) {
      continue;
    }

    const pairs = source.map((raw) => {
      const pair = object(raw);

      return {
        phrase: str(pair.phrase ?? pair.left),
        meaning: str(pair.meaning ?? pair.right),
      };
    });

    if (
      pairs.every(
        (pair) => pair.phrase && pair.meaning
      )
    ) {
      return pairs;
    }
  }

  return [];
}

function checkMatching(
  rawContent: unknown,
  rawAnswer: unknown
): boolean {
  const content = object(rawContent);
  const pairs = matchingPairs(rawContent, rawAnswer);

  if (
    pairs.length < 2 ||
    !unique(pairs.map((pair) => pair.phrase)) ||
    !unique(pairs.map((pair) => pair.meaning))
  ) {
    return false;
  }

  const leftItems = stringList(content.leftItems);
  const rightItems = stringList(content.rightItems);

  // If the original Activity Builder lists are present,
  // ensure they correspond to the answer key.
  if (
    content.leftItems !== undefined ||
    content.rightItems !== undefined
  ) {
    if (
      leftItems.length !== pairs.length ||
      rightItems.length !== pairs.length ||
      !unique(leftItems) ||
      !unique(rightItems)
    ) {
      return false;
    }

    const expectedLeft = new Set(
      pairs.map((pair) => pair.phrase)
    );
    const expectedRight = new Set(
      pairs.map((pair) => pair.meaning)
    );

    return (
      leftItems.every((value) => expectedLeft.has(value)) &&
      rightItems.every((value) => expectedRight.has(value))
    );
  }

  return true;
}

function validFlipCards(rawContent: unknown): boolean {
  const content = object(rawContent);

  if (
    !Array.isArray(content.cards) ||
    content.cards.length < 2
  ) {
    return false;
  }

  const cards = content.cards.map((raw) => object(raw));

  return (
    cards.every(
      (card) => str(card.front) && str(card.back)
    ) &&
    unique(cards.map((card) => str(card.front)))
  );
}

function validWordOrder(
  rawContent: unknown,
  rawAnswer: unknown
): boolean {
  const content = object(rawContent);
  const answer = object(rawAnswer);

  const sentence = str(
    answer.correct_answer ??
    answer.answer ??
    content.sentence
  );

  const words = sentence.split(/\s+/).filter(Boolean);

  return (
    words.length >= 2 &&
    words.length <= 20
  );
}

function validAssessmentQuestions(value: unknown): boolean {
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    value.length > 5
  ) {
    return false;
  }

  return value.every((raw) => {
    const question = object(raw);

    const options = stringList(question.options);
    const correct = str(question.correct_answer);

    return (
      str(question.prompt).length >= 5 &&
      str(question.explanation).length >= 5 &&
      options.length === 3 &&
      unique(options) &&
      options.includes(correct)
    );
  });
}

export async function getLessonReadiness(
  lessonId: string
): Promise<ReadinessReport> {
  if (!UUID.test(lessonId)) {
    throw new Error("Invalid lesson ID.");
  }

  const supabase = await createClient();

  // ---------------------------------------------------
  // CURRICULUM HIERARCHY
  // ---------------------------------------------------

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
      .select("id, course_id, title, status")
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
      .select("id, title, status")
      .eq("id", unit.course_id)
      .single();

  if (courseError || !course) {
    throw new Error(
      courseError?.message || "Course not found."
    );
  }

  // ---------------------------------------------------
  // FETCH SAVED LESSON CONTENT
  // ---------------------------------------------------

  const [
    vocabularyResult,
    stepsResult,
    activitiesResult,
    assessmentsResult,
  ] = await Promise.all([
    supabase
      .from("lesson_vocabulary")
      .select(
        "phrase, meaning, language_locale, status"
      )
      .eq("lesson_id", lessonId)
      .neq("status", "archived"),

    supabase
      .from("lesson_steps")
      .select(
        "step_number, step_type, title, content, status"
      )
      .eq("lesson_id", lessonId)
      .neq("status", "archived")
      .order("step_number"),

    supabase
      .from("lesson_activities")
      .select(
        "activity_number, activity_type, title, content, answer_config, status"
      )
      .eq("lesson_id", lessonId)
      .neq("status", "archived")
      .order("activity_number"),

    supabase
      .from("ai_assessment_drafts")
      .select("id, title, status, questions")
      .eq("lesson_id", lessonId),
  ]);

  for (const result of [
    vocabularyResult,
    stepsResult,
    activitiesResult,
    assessmentsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const vocabulary = vocabularyResult.data ?? [];
  const steps = stepsResult.data ?? [];
  const activities = activitiesResult.data ?? [];
  const assessments = assessmentsResult.data ?? [];

  const checks: ReadinessCheck[] = [];

  function add(
    id: string,
    label: string,
    status: CheckStatus,
    details: string
  ) {
    checks.push({
      id,
      label,
      status,
      details,
    });
  }

  // ---------------------------------------------------
  // 1. CURRICULUM
  // ---------------------------------------------------

  const draftHierarchy =
    course.status === "draft" &&
    unit.status === "draft" &&
    lesson.status === "draft";

  add(
    "hierarchy",
    "Draft curriculum hierarchy",
    draftHierarchy ? "pass" : "fail",
    draftHierarchy
      ? "Course, unit, and lesson are available for draft review."
      : "The course, unit, and lesson must all be drafts for this review workflow."
  );

  // ---------------------------------------------------
  // 2. VOCABULARY
  // ---------------------------------------------------

  const validVocabulary =
    vocabulary.length >= 3 &&
    vocabulary.every(
      (item) =>
        str(item.phrase).length > 0 &&
        str(item.meaning).length > 0 &&
        str(item.language_locale).length > 0
    ) &&
    unique(
      vocabulary.map((item) => str(item.phrase))
    );

  add(
    "vocabulary",
    "Vocabulary content",
    validVocabulary ? "pass" : "fail",
    validVocabulary
      ? `${vocabulary.length} valid vocabulary entries were found.`
      : "At least three unique vocabulary entries with meanings and language locales are required."
  );

  // ---------------------------------------------------
  // 3. TEACHING STEPS
  // ---------------------------------------------------

  const ordered =
    steps.length >= 5 &&
    steps.every(
      (step, index) =>
        step.step_number === index + 1 &&
        str(step.title).length > 0
    );

  add(
    "ordered-steps",
    "Ordered lesson steps",
    ordered ? "pass" : "fail",
    ordered
      ? `${steps.length} sequential lesson steps found.`
      : "Lesson steps must have titles and continuous numbering starting at 1."
  );

  const stepTypes = new Set(
    steps.map((step) => step.step_type)
  );

  const required = [
    "introduction",
    "vocabulary",
    "listening",
    "speaking",
    "dialogue",
    "word_order",
    "summary",
  ];

  for (const type of required) {
    const exists = stepTypes.has(type);

    add(
      `step-${type}`,
      `${type.replace(/_/g, " ")} step`,
      exists ? "pass" : "fail",
      exists
        ? `A ${type.replace(/_/g, " ")} step exists.`
        : `Missing ${type.replace(/_/g, " ")} step.`
    );
  }

  const badStep = steps.find((step) => {
    const content = object(step.content);

    switch (step.step_type) {
      case "introduction":
      case "summary":
        return str(content.text).length < 10;

      case "vocabulary":
      case "listening":
      case "speaking":
        return (
          !str(content.phrase) ||
          !str(content.locale)
        );

      case "dialogue":
        return (
          !str(content.line_a) ||
          !str(content.line_b) ||
          !str(content.translation)
        );

      case "word_order": {
        const sentence = str(content.sentence);
        const count = sentence
          .split(/\s+/)
          .filter(Boolean).length;

        return (
          !str(content.prompt) ||
          count < 2 ||
          count > 10
        );
      }

      default:
        return false;
    }
  });

  add(
    "teaching-content",
    "Teaching step content",
    badStep ? "fail" : "pass",
    badStep
      ? `Step ${badStep.step_number} needs corrections.`
      : "All required teaching-step fields are present."
  );

  // ---------------------------------------------------
  // 4. MULTIPLE CHOICE
  // ---------------------------------------------------

  const multipleChoices = activities.filter(
    (activity) =>
      activity.activity_type === "multiple_choice"
  );

  const validChoices = multipleChoices.filter(
    (activity) =>
      validMultipleChoice(
        activity.content,
        activity.answer_config
      ).answersValid
  );

  add(
    "multiple-choice",
    "Multiple-choice answer validation",
    validChoices.length > 0 &&
      validChoices.length === multipleChoices.length
      ? "pass"
      : "fail",
    validChoices.length > 0 &&
      validChoices.length === multipleChoices.length
      ? `${validChoices.length} multiple-choice activity(s) have valid options and answer keys.`
      : "At least one multiple-choice activity is required, and all existing multiple-choice answer keys must be valid."
  );

  if (validChoices.length > 0) {
    const missingPrompt = validChoices.some(
      (activity) =>
        !validMultipleChoice(
          activity.content,
          activity.answer_config
        ).hasPrompt
    );

    add(
      "multiple-choice-prompt",
      "Multiple-choice question prompt",
      missingPrompt ? "warning" : "pass",
      missingPrompt
        ? "The existing activity has a valid answer key but no saved question prompt. Add the prompt in Activity Builder or use a reviewed learner-preview adapter before publishing."
        : "Multiple-choice prompts are available."
    );
  }

  // ---------------------------------------------------
  // 5. MATCHING
  // ---------------------------------------------------

  const matchingActivities = activities.filter(
    (activity) =>
      activity.activity_type === "matching"
  );

  const matchingValid =
    matchingActivities.length > 0 &&
    matchingActivities.every(
      (activity) =>
        checkMatching(
          activity.content,
          activity.answer_config
        )
    );

  add(
    "matching",
    "Matching practice",
    matchingValid ? "pass" : "fail",
    matchingValid
      ? `${matchingActivities.length} matching activity(s) have valid pairs.`
      : "Matching activities must have consistent phrases, meanings, and answer pairs."
  );

  // ---------------------------------------------------
  // 6. FLASHCARDS
  // ---------------------------------------------------

  const flipCards = activities.filter(
    (activity) =>
      activity.activity_type === "flip_cards"
  );

  const flashcardsValid =
    flipCards.length > 0 &&
    flipCards.every(
      (activity) => validFlipCards(activity.content)
    );

  add(
    "flashcards",
    "Vocabulary flashcards",
    flipCards.length === 0
      ? "warning"
      : flashcardsValid
        ? "pass"
        : "fail",
    flipCards.length === 0
      ? "No flashcard activity is saved; flashcards are optional."
      : flashcardsValid
        ? `${flipCards.length} flashcard activity(s) have valid front/back cards.`
        : "The flashcard activity has missing or duplicate card fronts."
  );

  // ---------------------------------------------------
  // 7. OTHER ACTIVITY FORMATS
  // ---------------------------------------------------

  const wordOrderActivities = activities.filter(
    (activity) =>
      activity.activity_type === "word_order"
  );

  const validWordOrders = wordOrderActivities.every(
    (activity) =>
      validWordOrder(
        activity.content,
        activity.answer_config
      )
  );

  const supportedTypes = new Set([
    "flip_cards",
    "matching",
    "multiple_choice",
    "word_order",
  ]);

  const unknownTypes = activities.filter(
    (activity) =>
      !supportedTypes.has(activity.activity_type)
  );

  add(
    "activity-formats",
    "Activity format validation",
    !validWordOrders
      ? "fail"
      : unknownTypes.length > 0
        ? "warning"
        : "pass",
    !validWordOrders
      ? "One or more word-order activities contain invalid answer data."
      : unknownTypes.length > 0
        ? `${unknownTypes.length} activity(s) need additional format validation.`
        : "Known activity formats have been checked against supported data structures."
  );

  // ---------------------------------------------------
  // 8. KNOWLEDGE CHECK
  // ---------------------------------------------------

  const assessment = assessments[0];

  const assessmentValid =
    assessments.length === 1 &&
    validAssessmentQuestions(assessment.questions);

  add(
    "assessment",
    "Knowledge Check assessment",
    assessmentValid ? "pass" : "fail",
    assessmentValid
      ? `${assessment.questions.length} structurally valid assessment questions were found.`
      : "A Knowledge Check with 3–5 questions, valid options, correct answers, and explanations is required."
  );

  if (assessmentValid) {
    add(
      "assessment-review",
      "Assessment approval",
      assessment.status === "approved"
        ? "pass"
        : "warning",
      assessment.status === "approved"
        ? "Assessment approval is recorded."
        : "The Knowledge Check is still a draft. It requires final Admin review before publication."
    );
  }

  // ---------------------------------------------------
  // 9. DRAFT CONTENT STATUS
  // ---------------------------------------------------

  const allDraft =
    vocabulary.every((item) => item.status === "draft") &&
    steps.every((item) => item.status === "draft") &&
    activities.every(
      (item) => item.status === "draft"
    );

  add(
    "draft-status",
    "Content lifecycle consistency",
    allDraft ? "pass" : "warning",
    allDraft
      ? "Vocabulary, teaching steps, and activities are currently drafts."
      : "Some content has a different lifecycle status. Review before publishing."
  );

  // ---------------------------------------------------
  // RESULT
  // ---------------------------------------------------

  const errors = checks.filter(
    (check) => check.status === "fail"
  ).length;

  const warnings = checks.filter(
    (check) => check.status === "warning"
  ).length;

  return {
    lessonId: lesson.id,
    courseTitle: course.title,
    unitTitle: unit.title,
    lessonTitle: lesson.title,
    lessonStatus: lesson.status,
    checks,
    counts: {
      vocabulary: vocabulary.length,
      steps: steps.length,
      activities: activities.length,
      assessments: assessments.length,
    },
    ready: errors === 0,
    errors,
    warnings,
  };
}
