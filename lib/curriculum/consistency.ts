
export type ConsistencySeverity = "error" | "warning" | "info";

export type ConsistencyIssue = {
  id: string;
  severity: ConsistencySeverity;
  category: string;
  title: string;
  details: string;
  action: string;
};

export type VocabularyRecord = {
  id: string;
  lesson_id: string;
  phrase: string;
  meaning: string;
};

export type StepRecord = {
  id: string;
  step_number: number;
  step_type: string;
  title: string;
  content: Record<string, unknown>;
};

export type ActivityRecord = {
  id: string;
  activity_number: number;
  activity_type: string;
  title: string;
  content: Record<string, unknown>;
  answer_config: Record<string, unknown>;
};

export type AssessmentRecord = {
  id: string;
  title: string;
  questions: unknown;
};

export type ConsistencyInput = {
  lessonId: string;
  lessonTitle: string;
  vocabulary: VocabularyRecord[];
  courseVocabulary: VocabularyRecord[];
  lessons: Array<{ id: string; title: string }>;
  steps: StepRecord[];
  activities: ActivityRecord[];
  assessment: AssessmentRecord | null;
};

export type ConsistencyReport = {
  lessonId: string;
  lessonTitle: string;
  issues: ConsistencyIssue[];
  counts: {
    vocabulary: number;
    steps: number;
    activities: number;
    questions: number;
  };
  errors: number;
  warnings: number;
  infos: number;
};

function object(value: unknown): Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function valueText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0
  ).map((item) => item.trim());
}

function normalized(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function sameMeaning(a: string, b: string): boolean {
  return normalized(a) === normalized(b);
}

function hasJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/u.test(value);
}

function hasEnglishLetters(value: string): boolean {
  return /[A-Za-z]/.test(value);
}

function readPairs(
  content: Record<string, unknown>,
  answer: Record<string, unknown>
): Array<{ phrase: string; meaning: string }> {
  const source = Array.isArray(answer.pairs)
    ? answer.pairs
    : Array.isArray(content.pairs)
      ? content.pairs
      : [];

  return source.map((raw) => {
    const item = object(raw);
    return {
      phrase: valueText(item.phrase ?? item.left),
      meaning: valueText(item.meaning ?? item.right),
    };
  });
}

export function analyzeLessonConsistency(
  input: ConsistencyInput
): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];
  let sequence = 0;

  function add(
    severity: ConsistencySeverity,
    category: string,
    title: string,
    details: string,
    action: string
  ) {
    sequence += 1;

    issues.push({
      id: `issue-${sequence}`,
      severity,
      category,
      title,
      details,
      action,
    });
  }

  const vocabByPhrase = new Map<string, VocabularyRecord[]>();

  for (const vocabulary of input.vocabulary) {
    const key = normalized(vocabulary.phrase);
    if (!key) continue;

    const existing = vocabByPhrase.get(key) ?? [];
    vocabByPhrase.set(key, [...existing, vocabulary]);
  }

  // Exact duplicates inside the current lesson.
  for (const records of vocabByPhrase.values()) {
    if (records.length > 1) {
      add(
        "error",
        "Vocabulary",
        `Duplicate vocabulary: ${records[0].phrase}`,
        `This phrase appears ${records.length} times in the same lesson's vocabulary records.`,
        "Open the Lesson Content Manager and correct the duplicated vocabulary entries."
      );
    }
  }

  // Repetition across the course may be intentional.
  const crossLessonKeys = new Set<string>();

  for (const item of input.vocabulary) {
    const key = normalized(item.phrase);
    if (!key || crossLessonKeys.has(key)) continue;

    crossLessonKeys.add(key);

    const otherLessonIds = Array.from(
      new Set(
        input.courseVocabulary
          .filter(
            (record) =>
              record.lesson_id !== input.lessonId &&
              normalized(record.phrase) === key
          )
          .map((record) => record.lesson_id)
      )
    );

    if (otherLessonIds.length) {
      const names = otherLessonIds.map(
        (id) =>
          input.lessons.find((lesson) => lesson.id === id)
            ?.title ?? "Another lesson"
      );

      add(
        "warning",
        "Repetition",
        `Repeated phrase: ${item.phrase}`,
        `This phrase also appears in: ${names.join(", ")}.`,
        "Check whether this is useful spaced repetition or unnecessary duplication."
      );
    }
  }

  // Identify stored expressions whose translations differ.
  function compareTranslation(
    phrase: string,
    meaning: string,
    source: string
  ) {
    const matches = vocabByPhrase.get(normalized(phrase));

    if (!matches?.length || !meaning.trim()) return;

    if (
      !matches.some((record) =>
        sameMeaning(record.meaning, meaning)
      )
    ) {
      add(
        "warning",
        "Translation",
        `Review translation: ${phrase}`,
        `${source} uses "${meaning}", while the lesson vocabulary uses "${matches.map((item) => item.meaning).join(" / ")}".`,
        "Check whether both meanings are acceptable in context, then correct any inaccurate record."
      );
    }
  }

  // Teaching steps.
  const seenStepPhrases = new Set<string>();
  const vocabularyPhrases = new Set(
    input.vocabulary.map((item) => normalized(item.phrase))
  );

  let redundantListening = 0;

  for (const step of input.steps) {
    const content = step.content;

    if (step.step_type === "vocabulary") {
      const phrase = valueText(content.phrase);
      if (phrase) seenStepPhrases.add(normalized(phrase));

      compareTranslation(
        phrase,
        valueText(content.meaning),
        `Teaching step ${step.step_number}`
      );
    }

    if (step.step_type === "listening") {
      const phrase = valueText(content.phrase);
      if (vocabularyPhrases.has(normalized(phrase))) {
        redundantListening += 1;
      }
    }

    if (step.step_type === "dialogue") {
      const speakerA = valueText(content.speaker_a);
      const speakerB = valueText(content.speaker_b);
      const lineA = valueText(content.line_a);
      const lineB = valueText(content.line_b);

      const legacyA =
        hasJapanese(speakerA) &&
        hasEnglishLetters(lineA) &&
        !hasJapanese(lineA);

      const legacyB =
        hasJapanese(speakerB) &&
        hasEnglishLetters(lineB) &&
        !hasJapanese(lineB);

      if (legacyA || legacyB) {
        add(
          "error",
          "Dialogue",
          "Dialogue expression and speaker fields appear reversed",
          "The saved data contains Japanese expressions in speaker fields and English text in dialogue-line fields.",
          "Move speaker names to speaker_a/speaker_b, Japanese expressions to line_a/line_b, and accurate English translations to the translation field."
        );
      }

      if (!lineA || !lineB) {
        add(
          "error",
          "Dialogue",
          "Incomplete conversation",
          "One or both dialogue lines are missing.",
          "Complete the Japanese dialogue lines in Lesson Content Manager."
        );
      }

      if (
        !legacyA &&
        !legacyB &&
        lineA &&
        lineB &&
        !hasJapanese(lineA) &&
        !hasJapanese(lineB) &&
        input.lessonTitle.toLowerCase().includes("hello")
      ) {
        add(
          "warning",
          "Dialogue",
          "Check the dialogue's target language",
          "Both dialogue lines appear to lack Japanese writing.",
          "Verify that the conversation is actually teaching the target language."
        );
      }

      if (!valueText(content.translation)) {
        add(
          "warning",
          "Dialogue",
          "Dialogue translation missing",
          "The conversation has no combined English translation.",
          "Add a correct translation for both speakers."
        );
      } else {
        add(
          "info",
          "Dialogue",
          "Review conversation translation manually",
          "The checker cannot reliably prove that a Japanese dialogue and its English translation have identical meaning.",
          "Read the conversation in the learner preview and verify each speaker's translation."
        );
      }
    }
  }

  if (redundantListening > 0) {
    add(
      "warning",
      "Lesson Flow",
      `${redundantListening} potentially redundant listening step(s)`,
      "These listening steps repeat vocabulary expressions that already have manual speaker buttons.",
      "Review whether to retain dedicated listening practice. The current preview hides these standalone steps."
    );
  }

  // Interactive activities.
  for (const activity of input.activities) {
    const content = activity.content;
    const answer = activity.answer_config;
    const source = `Activity ${activity.activity_number}: ${activity.title}`;

    if (activity.activity_type === "flip_cards") {
      const cards = Array.isArray(content.cards)
        ? content.cards
        : [];

      if (cards.length < 2) {
        add(
          "error",
          "Flashcards",
          "Too few flashcards",
          `${source} needs at least two usable cards.`,
          "Add or correct flashcards in Activity Builder."
        );
      }

      for (const raw of cards) {
        const card = object(raw);
        const front = valueText(card.front);
        const back = valueText(card.back);

        if (!front || !back) {
          add(
            "error",
            "Flashcards",
            "Incomplete flashcard",
            `${source} contains a card without a front or back.`,
            "Complete the missing card fields."
          );
        } else {
          compareTranslation(front, back, source);
        }
      }
    }

    if (activity.activity_type === "matching") {
      const pairs = readPairs(content, answer);

      if (
        pairs.length < 2 ||
        pairs.some((pair) => !pair.phrase || !pair.meaning)
      ) {
        add(
          "error",
          "Matching",
          "Invalid matching pairs",
          `${source} needs at least two complete phrase-meaning pairs.`,
          "Correct the pairs in Activity Builder."
        );
      } else {
        const phrases = pairs.map((pair) => normalized(pair.phrase));
        const meanings = pairs.map((pair) => normalized(pair.meaning));

        if (
          new Set(phrases).size !== phrases.length ||
          new Set(meanings).size !== meanings.length
        ) {
          add(
            "error",
            "Matching",
            "Duplicate matching values",
            `${source} contains repeated phrase or meaning values.`,
            "Make the matching pairs distinct."
          );
        }

        for (const pair of pairs) {
          compareTranslation(pair.phrase, pair.meaning, source);
        }

        const left = textArray(content.leftItems);
        const right = textArray(content.rightItems);

        if (
          content.leftItems !== undefined ||
          content.rightItems !== undefined
        ) {
          if (
            left.length !== pairs.length ||
            right.length !== pairs.length ||
            !pairs.every(
              (pair) =>
                left.includes(pair.phrase) &&
                right.includes(pair.meaning)
            )
          ) {
            add(
              "error",
              "Matching",
              "Matching lists disagree with answer pairs",
              `${source} has displayed choices that do not match the stored correct pairs.`,
              "Synchronize leftItems, rightItems, and answer_config.pairs."
            );
          }
        }
      }
    }

    if (activity.activity_type === "multiple_choice") {
      const prompt = valueText(
        content.prompt ??
        content.question ??
        content.question_text
      );

      const options = textArray(content.options);
      const correct = valueText(
        answer.correct_answer ?? answer.answer
      );

      if (prompt.length < 5) {
        add(
          "error",
          "Multiple Choice",
          "Missing vocabulary quiz question",
          `${source} has no meaningful question prompt.`,
          "Add a specific question that matches the existing answer."
        );
      }

      if (
        options.length < 2 ||
        new Set(options.map(normalized)).size !== options.length ||
        !options.includes(correct)
      ) {
        add(
          "error",
          "Multiple Choice",
          "Invalid answer configuration",
          `${source} has duplicated options, missing options, or a correct answer absent from the choices.`,
          "Review content.options and answer_config.answer/correct_answer."
        );
      }
    }
  }

  // Knowledge Check.
  const questions = Array.isArray(input.assessment?.questions)
    ? input.assessment.questions
    : [];

  if (!input.assessment || questions.length < 3) {
    add(
      "error",
      "Knowledge Check",
      "Assessment is missing or incomplete",
      "The lesson requires a Knowledge Check with at least three questions.",
      "Generate or correct the assessment before approval."
    );
  }

  const prompts = new Map<string, number>();

  questions.forEach((raw, index) => {
    const question = object(raw);
    const prompt = valueText(question.prompt);
    const explanation = valueText(question.explanation);
    const options = textArray(question.options);
    const answer = valueText(question.correct_answer);

    const key = normalized(prompt);

    if (key) {
      prompts.set(key, (prompts.get(key) ?? 0) + 1);
    }

    if (
      prompt.length < 5 ||
      explanation.length < 5 ||
      options.length !== 3 ||
      new Set(options.map(normalized)).size !== 3 ||
      !options.includes(answer)
    ) {
      add(
        "error",
        "Knowledge Check",
        `Question ${index + 1} has invalid data`,
        "The prompt, explanation, options, or correct answer is incomplete or inconsistent.",
        "Open the Lesson Content Manager and correct the assessment question."
      );
    }
  });

  for (const [prompt, count] of prompts) {
    if (count > 1) {
      add(
        "warning",
        "Knowledge Check",
        "Repeated assessment question",
        `The same normalized question appears ${count} times.`,
        "Keep one version or rewrite the repeated questions to test different learning objectives."
      );
    }
  }

  // Missing section reports.
  if (input.vocabulary.length === 0) {
    add(
      "error",
      "Vocabulary",
      "No saved vocabulary",
      "This lesson has no editable vocabulary records.",
      "Generate lesson vocabulary before approval."
    );
  }

  if (input.steps.length === 0) {
    add(
      "error",
      "Teaching Steps",
      "No teaching steps",
      "The lesson has no generated teaching sequence.",
      "Generate and approve a draft teaching package."
    );
  }

  if (input.activities.length === 0) {
    add(
      "error",
      "Activities",
      "No interactive activities",
      "No activity records were found for this lesson.",
      "Use the Activity Builder or AI Practice Generator."
    );
  }

  return {
    lessonId: input.lessonId,
    lessonTitle: input.lessonTitle,
    issues,
    counts: {
      vocabulary: input.vocabulary.length,
      steps: input.steps.length,
      activities: input.activities.length,
      questions: questions.length,
    },
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    infos: issues.filter((issue) => issue.severity === "info").length,
  };
}
