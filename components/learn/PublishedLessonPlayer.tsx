
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Layers3,
  MessageCircle,
  Mic,
  Trophy,
  Volume2,
} from "lucide-react";

import PublishedKnowledgeCheck from "@/components/learn/PublishedKnowledgeCheck";
import LessonCompletionRewards from "@/components/learn/LessonCompletionRewards";

import type { KnowledgeResult } from "@/lib/learn/knowledge-check-actions";

// =====================================================
// TYPES
// =====================================================

type JsonObject = Record<string, unknown>;

export type PublishedLessonData = {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  unitTitle: string;
  vocabulary: unknown[];
  steps: unknown[];
  flashcards: unknown[];
};

type SlideType =
  | "introduction"
  | "vocabulary"
  | "speaking"
  | "dialogue"
  | "flashcards"
  | "summary"
  | "assessment"
  | "completion";

type Slide = {
  id: string;
  type: SlideType;
  title: string;
  content: JsonObject;
};

type SpeakerProps = {
  phrase: string;
  locale: string;
  onError: (message: string) => void;
  compact?: boolean;
};

// =====================================================
// STYLES
// =====================================================

const primaryButton =
  "inline-flex items-center justify-center gap-2 " +
  "rounded-xl bg-[#3558AE] px-5 py-3 " +
  "text-sm font-bold text-white transition " +
  "hover:bg-[#2A255C] disabled:cursor-not-allowed " +
  "disabled:opacity-40";

const secondaryButton =
  "inline-flex items-center justify-center gap-2 " +
  "rounded-xl border border-[#ddd7f6] bg-white " +
  "px-5 py-3 text-sm font-bold text-[#3558AE] " +
  "transition hover:bg-[#f5f2ff] " +
  "disabled:cursor-not-allowed disabled:opacity-40";

// =====================================================
// SAFE JSON HELPERS
// =====================================================

function asObject(value: unknown): JsonObject {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as JsonObject;
  }

  return {};
}

function asString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function containsJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/u.test(value);
}

function getSpeechLocale(
  phrase: string,
  fallback: string
): string {
  if (containsJapanese(phrase)) {
    return "ja-JP";
  }

  return fallback;
}

// =====================================================
// SPEECH SYNTHESIS
// =====================================================

function speakText(
  phrase: string,
  locale: string
): boolean {
  if (
    !phrase ||
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    return false;
  }

  const synth = window.speechSynthesis;

  synth.cancel();

  const language = locale.toLowerCase().split("-")[0];

  const voices = synth.getVoices();

  const matchingVoice =
    voices.find(
      (voice) =>
        voice.lang.toLowerCase() ===
        locale.toLowerCase()
    ) ??
    voices.find(
      (voice) =>
        voice.lang.toLowerCase().split("-")[0] ===
        language
    );

  if (!matchingVoice) {
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(
    phrase
  );

  utterance.lang = locale;
  utterance.voice = matchingVoice;
  utterance.rate = 0.85;
  utterance.pitch = 1;

  synth.speak(utterance);

  return true;
}

// =====================================================
// REUSABLE SPEAKER BUTTON
// =====================================================

function SpeakerButton({
  phrase,
  locale,
  onError,
  compact = false,
}: SpeakerProps) {
  return (
    <button
      type="button"
      disabled={!phrase}
      aria-label={`Listen to ${phrase}`}
      onClick={(event) => {
        event.stopPropagation();

        onError("");

        const success = speakText(phrase, locale);

        if (!success) {
          onError(
            "No matching speech voice is available " +
            "for this language on your device."
          );
        }
      }}
      className={
        compact
          ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ddd7f6] bg-white text-[#3558AE] transition hover:bg-[#f5f2ff] disabled:opacity-40"
          : primaryButton
      }
    >
      <Volume2 size={18} />
      {!compact && "Listen"}
    </button>
  );
}

// =====================================================
// BUILD LEARNER-SAFE LESSON SLIDES
// =====================================================

function createSlides(
  lesson: PublishedLessonData
): Slide[] {
  const slides: Slide[] = [];

  const teaching = lesson.steps.map(asObject);

  // 1. Introduction
  const introduction = teaching.find(
    (item) =>
      asString(item.type) === "introduction"
  );

  if (introduction) {
    slides.push({
      id: "introduction",
      type: "introduction",
      title:
        asString(introduction.title) ||
        "Welcome to Your Lesson",
      content: asObject(introduction.content),
    });
  }

  // 2. Vocabulary
  // Use vocabulary entries directly.
  // Do not duplicate vocabulary teaching steps.
  lesson.vocabulary.forEach((raw, index) => {
    const content = asObject(raw);

    if (!asString(content.phrase)) {
      return;
    }

    slides.push({
      id: `vocabulary-${index}`,
      type: "vocabulary",
      title: "Learn a New Expression",
      content,
    });
  });

  // 3. Speaking and Dialogue
  // Standalone listening repetitions are intentionally omitted.
  teaching.forEach((step, index) => {
    const type = asString(step.type);

    if (
      type !== "speaking" &&
      type !== "dialogue"
    ) {
      return;
    }

    const content = asObject(step.content);

    if (
      type === "speaking" &&
      !asString(content.phrase)
    ) {
      return;
    }

    slides.push({
      id: `${type}-${index}`,
      type,
      title:
        asString(step.title) ||
        (type === "speaking"
          ? "Speaking Practice"
          : "Practice a Conversation"),
      content,
    });
  });

  // 4. Flashcards
  lesson.flashcards.forEach((raw, index) => {
    const activity = asObject(raw);
    const cards = asArray(activity.cards);

    if (cards.length === 0) {
      return;
    }

    slides.push({
      id: `flashcards-${index}`,
      type: "flashcards",
      title:
        asString(activity.title) ||
        "Vocabulary Flashcards",
      content: { cards },
    });
  });

  // 5. Summary
  const summary = teaching.find(
    (step) => asString(step.type) === "summary"
  );

  if (summary) {
    slides.push({
      id: "summary",
      type: "summary",
      title:
        asString(summary.title) ||
        "Lesson Summary",
      content: asObject(summary.content),
    });
  }

  // 6. Server-graded Knowledge Check
  slides.push({
    id: "assessment",
    type: "assessment",
    title: "Knowledge Check",
    content: {},
  });

  // 7. Completion and real rewards
  slides.push({
    id: "completion",
    type: "completion",
    title: "Your Learning Results",
    content: {},
  });

  return slides;
}

// =====================================================
// MAIN LEARNER PLAYER
// =====================================================

export default function PublishedLessonPlayer({
  lesson,
}: {
  lesson: PublishedLessonData;
}) {
  const slides = useMemo(
    () => createSlides(lesson),
    [lesson]
  );

  const [index, setIndex] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [audioError, setAudioError] = useState("");

  const [result, setResult] =
    useState<KnowledgeResult | null>(null);

  const slide = slides[index];
  const content = slide.content;

  const cards = asArray(content.cards);
  const card = asObject(cards[cardIndex]);

  const locale =
    asString(content.locale) || "ja-JP";

  const progress = Math.round(
    ((index + 1) / slides.length) * 100
  );

  // Stop any ongoing speech when changing slides.
  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, [index]);

  // ===================================================
  // NAVIGATION
  // ===================================================

  function navigate(nextIndex: number) {
    if (
      nextIndex < 0 ||
      nextIndex >= slides.length
    ) {
      return;
    }

    // Never skip the Knowledge Check.
    if (
      slides[nextIndex].type === "completion" &&
      result === null
    ) {
      return;
    }

    setIndex(nextIndex);
    setCardIndex(0);
    setFlipped(false);
    setAudioError("");
  }

  // Called only after Knowledge Check grading
  // has been confirmed by the server.
  function handleKnowledgeCheckFinished(
    grade: KnowledgeResult
  ) {
    setResult(grade);

    const completionIndex = slides.findIndex(
      (item) => item.type === "completion"
    );

    if (completionIndex >= 0) {
      setIndex(completionIndex);
      setCardIndex(0);
      setFlipped(false);
      setAudioError("");
    }
  }

  function handleReviewAgain() {
    navigate(0);
  }

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] px-4 py-8 text-[#2A255C]">
      <div className="mx-auto max-w-2xl">

        {/* TOP NAVIGATION */}

        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            href="/learn/published"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#3558AE] hover:underline"
          >
            <ArrowLeft size={17} />
            Course Roadmap
          </Link>

          <span className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#3558AE]">
            Learning Mode
          </span>
        </div>

        {/* MAIN LESSON CARD */}

        <div className="overflow-hidden rounded-3xl border border-white bg-white/95 shadow-xl">

          {/* LESSON HEADER */}

          <header className="border-b border-slate-100 p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-[#3558AE]">
              {lesson.courseTitle} · {lesson.unitTitle}
            </p>

            <h1 className="mt-2 text-xl font-extrabold">
              {lesson.lessonTitle}
            </h1>

            <div className="mt-5 flex items-center gap-3">
              <div
                role="progressbar"
                aria-label="Lesson viewing progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-2 flex-1 overflow-hidden rounded-full bg-[#ece9f8]"
              >
                <div
                  className="h-full rounded-full bg-[#3558AE] transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <span className="text-xs font-bold tabular-nums text-slate-500">
                {index + 1}/{slides.length}
              </span>
            </div>
          </header>

          {/* SLIDE CONTENT */}

          <section className="min-h-[420px] px-5 py-8 sm:px-9">
            <div className="mx-auto max-w-xl">

              {/* SLIDE HEADING */}

              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0edff] text-[#3558AE]">
                  {slide.type === "assessment" ? (
                    <ClipboardCheck size={30} />
                  ) : slide.type === "completion" ? (
                    <Trophy size={30} />
                  ) : slide.type === "flashcards" ? (
                    <Layers3 size={30} />
                  ) : slide.type === "dialogue" ? (
                    <MessageCircle size={30} />
                  ) : slide.type === "speaking" ? (
                    <Mic size={30} />
                  ) : (
                    <BookOpen size={30} />
                  )}
                </div>

                <p className="mt-5 text-xs font-bold uppercase tracking-widest text-[#3558AE]">
                  {slide.type === "assessment"
                    ? "Final Assessment"
                    : slide.type === "completion"
                      ? "Lesson Completion"
                      : slide.type.replace(/_/g, " ")}
                </p>

                <h2 className="mt-2 text-2xl font-extrabold">
                  {slide.title}
                </h2>
              </div>

              {/* INTRODUCTION AND SUMMARY */}

              {(
                slide.type === "introduction" ||
                slide.type === "summary"
              ) && (
                <p className="mt-8 whitespace-pre-line text-center text-base leading-8 text-slate-600">
                  {asString(content.text)}
                </p>
              )}

              {/* VOCABULARY AND SPEAKING */}

              {(
                slide.type === "vocabulary" ||
                slide.type === "speaking"
              ) && (
                <div className="mt-8 space-y-5 text-center">
                  {slide.type === "speaking" && (
                    <p className="text-sm leading-7 text-slate-600">
                      Listen to the expression, then
                      practice saying it aloud.
                    </p>
                  )}

                  <p
                    lang={locale.split("-")[0]}
                    className="break-words text-3xl font-extrabold"
                  >
                    {asString(content.phrase)}
                  </p>

                  {asString(content.romanization) && (
                    <p className="text-base font-semibold text-[#3558AE]">
                      {asString(content.romanization)}
                    </p>
                  )}

                  <div className="rounded-2xl bg-[#f5f2ff] p-5">
                    <p className="text-xs font-bold uppercase text-[#3558AE]">
                      English Meaning
                    </p>

                    <p className="mt-2 text-lg font-bold">
                      {asString(content.meaning)}
                    </p>

                    {asString(content.usage_note) && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {asString(content.usage_note)}
                      </p>
                    )}
                  </div>

                  <SpeakerButton
                    phrase={asString(content.phrase)}
                    locale={locale}
                    onError={setAudioError}
                  />

                  {slide.type === "speaking" && (
                    <p className="text-xs text-slate-500">
                      Practice aloud at your own pace.
                      Pronunciation scoring is not
                      enabled yet.
                    </p>
                  )}
                </div>
              )}

              {/* DIALOGUE */}

              {slide.type === "dialogue" && (
                <div className="mt-8 space-y-4">
                  <p className="text-center text-sm leading-7 text-slate-600">
                    Read the conversation and tap
                    the speaker buttons to listen.
                  </p>

                  {[
                    {
                      id: "a",
                      speaker:
                        asString(content.speaker_a) ||
                        "Speaker A",
                      line: asString(content.line_a),
                    },
                    {
                      id: "b",
                      speaker:
                        asString(content.speaker_b) ||
                        "Speaker B",
                      line: asString(content.line_b),
                    },
                  ].map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl bg-[#f5f2ff] p-5"
                    >
                      <p className="text-xs font-bold uppercase text-[#3558AE]">
                        {entry.speaker}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="break-words text-lg font-bold">
                          {entry.line}
                        </p>

                        <SpeakerButton
                          phrase={entry.line}
                          locale={getSpeechLocale(
                            entry.line,
                            locale
                          )}
                          onError={setAudioError}
                          compact
                        />
                      </div>
                    </div>
                  ))}

                  {asString(content.translation) && (
                    <div className="rounded-xl border border-[#e5e0f7] p-4">
                      <p className="text-xs font-bold uppercase text-[#3558AE]">
                        English Translation
                      </p>

                      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">
                        {asString(content.translation)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* FLASHCARDS */}

              {slide.type === "flashcards" && (
                <div className="mt-8 space-y-5">
                  <p className="text-center text-sm text-slate-600">
                    Tap the card to flip it.
                    Use the speaker button to listen.
                  </p>

                  {cards.length > 0 && (
                    <>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setFlipped((previous) => !previous)
                          }
                          className="flex min-h-52 w-full flex-col items-center justify-center rounded-3xl border-2 border-[#ddd7f6] bg-[#f5f2ff] px-12 py-6 text-center transition hover:shadow-sm"
                        >
                          <span className="text-xs font-bold uppercase text-[#3558AE]">
                            {flipped
                              ? "Meaning"
                              : "Expression"}
                          </span>

                          <span className="mt-5 break-words text-2xl font-extrabold">
                            {flipped
                              ? asString(card.back)
                              : asString(card.front)}
                          </span>

                          <span className="mt-4 text-xs text-slate-500">
                            Tap to flip
                          </span>
                        </button>

                        <div className="absolute right-3 top-3">
                          <SpeakerButton
                            phrase={asString(card.front)}
                            locale={getSpeechLocale(
                              asString(card.front),
                              locale
                            )}
                            onError={setAudioError}
                            compact
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          disabled={cardIndex === 0}
                          onClick={() => {
                            setCardIndex(
                              (previous) => previous - 1
                            );
                            setFlipped(false);
                            setAudioError("");
                          }}
                          className={secondaryButton}
                        >
                          <ChevronLeft size={17} />
                          Previous
                        </button>

                        <span className="text-sm font-bold tabular-nums">
                          {cardIndex + 1}/{cards.length}
                        </span>

                        <button
                          type="button"
                          disabled={
                            cardIndex >= cards.length - 1
                          }
                          onClick={() => {
                            setCardIndex(
                              (previous) => previous + 1
                            );
                            setFlipped(false);
                            setAudioError("");
                          }}
                          className={secondaryButton}
                        >
                          Next
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* KNOWLEDGE CHECK */}

              {slide.type === "assessment" && (
                <PublishedKnowledgeCheck
                  lessonId={lesson.lessonId}
                  onFinished={
                    handleKnowledgeCheckFinished
                  }
                />
              )}

              {/* LESSON COMPLETION AND REWARDS */}

              {slide.type === "completion" && (
                <LessonCompletionRewards
                  lessonId={lesson.lessonId}
                  assessment={result}
                  onReview={handleReviewAgain}
                />
              )}

              {/* AUDIO ERRORS */}

              {audioError && (
                <p
                  role="status"
                  className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
                >
                  {audioError}
                </p>
              )}
            </div>
          </section>

          {/* BOTTOM NAVIGATION */}

          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 p-6">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => navigate(index - 1)}
              className={secondaryButton}
            >
              <ArrowLeft size={17} />
              Back
            </button>

            {slide.type === "assessment" ? (
              <span className="max-w-44 text-right text-xs font-semibold text-slate-500">
                Finish the Knowledge Check to continue
              </span>
            ) : slide.type === "completion" ? (
              <Link
                href="/learn/published"
                className={secondaryButton}
              >
                Exit Lesson
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => navigate(index + 1)}
                className={primaryButton}
              >
                Continue
                <ArrowRight size={17} />
              </button>
            )}
          </footer>
        </div>

        {/* FOOTER */}

        <p className="mt-4 text-center text-xs text-slate-500">
          ACELINGUA · Secure Published Learning
        </p>
      </div>
    </main>
  );
}
