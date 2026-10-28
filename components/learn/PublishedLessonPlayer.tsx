
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Layers3,
  MessageCircle,
  Mic,
  RotateCcw,
  Trophy,
  Volume2,
} from "lucide-react";

import PublishedKnowledgeCheck from
  "@/components/learn/PublishedKnowledgeCheck";

import type { KnowledgeResult } from
  "@/lib/learn/knowledge-check-actions";

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

type Slide = {
  id: string;
  type:
    | "introduction"
    | "vocabulary"
    | "speaking"
    | "dialogue"
    | "flashcards"
    | "summary"
    | "assessment"
    | "completion";
  title: string;
  content: JsonObject;
};

function obj(value: unknown): JsonObject {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function containsJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/u.test(value);
}

function speak(
  phrase: string,
  locale: string
): boolean {
  if (
    !phrase ||
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) return false;

  const synth = window.speechSynthesis;
  synth.cancel();

  const language = locale.toLowerCase().split("-")[0];

  const voice =
    synth.getVoices().find(
      (item) =>
        item.lang.toLowerCase() === locale.toLowerCase()
    ) ??
    synth.getVoices().find(
      (item) =>
        item.lang.toLowerCase().split("-")[0] === language
    );

  if (!voice) return false;

  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = locale;
  utterance.voice = voice;
  utterance.rate = 0.85;
  synth.speak(utterance);

  return true;
}

function Speaker({
  phrase,
  locale,
  onError,
  compact = false,
}: {
  phrase: string;
  locale: string;
  onError: (message: string) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={!phrase}
      aria-label={`Listen to ${phrase}`}
      onClick={(event) => {
        event.stopPropagation();
        onError("");

        if (!speak(phrase, locale)) {
          onError(
            "No matching speech voice is installed " +
            "for this language."
          );
        }
      }}
      className={
        compact
          ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ddd7f6] bg-white text-[#3558AE]"
          : "inline-flex items-center justify-center gap-2 rounded-xl bg-[#3558AE] px-6 py-3 text-sm font-bold text-white hover:bg-[#2A255C]"
      }
    >
      <Volume2 size={18} />
      {!compact && "Listen"}
    </button>
  );
}

function createSlides(
  lesson: PublishedLessonData
): Slide[] {
  const slides: Slide[] = [];
  const teaching = lesson.steps.map(obj);

  const intro = teaching.find(
    (item) => str(item.type) === "introduction"
  );

  if (intro) {
    slides.push({
      id: "intro",
      type: "introduction",
      title: str(intro.title) || "Introduction",
      content: obj(intro.content),
    });
  }

  lesson.vocabulary.forEach((raw, index) => {
    const content = obj(raw);

    if (str(content.phrase)) {
      slides.push({
        id: `vocabulary-${index}`,
        type: "vocabulary",
        title: "Learn a New Expression",
        content,
      });
    }
  });

  teaching.forEach((item, index) => {
    const type = str(item.type);

    if (type !== "speaking" && type !== "dialogue") {
      return;
    }

    const content = obj(item.content);

    if (
      type === "speaking" &&
      !str(content.phrase)
    ) return;

    slides.push({
      id: `${type}-${index}`,
      type,
      title: str(item.title) ||
        (type === "speaking"
          ? "Try Speaking"
          : "Practice a Conversation"),
      content,
    });
  });

  lesson.flashcards.forEach((raw, index) => {
    const item = obj(raw);

    if (arr(item.cards).length) {
      slides.push({
        id: `flashcards-${index}`,
        type: "flashcards",
        title: str(item.title) || "Vocabulary Flashcards",
        content: { cards: item.cards },
      });
    }
  });

  const summary = teaching.find(
    (item) => str(item.type) === "summary"
  );

  if (summary) {
    slides.push({
      id: "summary",
      type: "summary",
      title: str(summary.title) || "Lesson Summary",
      content: obj(summary.content),
    });
  }

  slides.push({
    id: "assessment",
    type: "assessment",
    title: "Knowledge Check",
    content: {},
  });

  slides.push({
    id: "completion",
    type: "completion",
    title: "Your Learning Results",
    content: {},
  });

  return slides;
}

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

  const cards = arr(content.cards);
  const card = obj(cards[cardIndex]);
  const locale = str(content.locale) || "ja-JP";

  const progress = Math.round(
    ((index + 1) / slides.length) * 100
  );

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

  function navigate(next: number) {
    if (next < 0 || next >= slides.length) return;

    // Can't skip the Knowledge Check.
    if (
      slides[next]?.type === "completion" &&
      !result
    ) return;

    setIndex(next);
    setCardIndex(0);
    setFlipped(false);
    setAudioError("");
  }

  const buttonPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl " +
    "bg-[#3558AE] px-5 py-3 text-sm font-bold text-white " +
    "transition hover:bg-[#2A255C]";

  const buttonSecondary =
    "inline-flex items-center justify-center gap-2 rounded-xl " +
    "border border-[#ddd7f6] bg-white px-5 py-3 " +
    "text-sm font-bold text-[#3558AE] hover:bg-[#f5f2ff] " +
    "disabled:opacity-40";

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] px-4 py-8 text-[#2A255C]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            href="/learn/published"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#3558AE]"
          >
            <ArrowLeft size={17} />
            Course Roadmap
          </Link>

          <span className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#3558AE]">
            Learning Mode
          </span>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white bg-white/95 shadow-xl">
          <header className="border-b border-slate-100 p-6">
            <p className="text-xs font-bold uppercase text-[#3558AE]">
              {lesson.courseTitle} · {lesson.unitTitle}
            </p>

            <h1 className="mt-2 text-xl font-extrabold">
              {lesson.lessonTitle}
            </h1>

            <div className="mt-5 flex items-center gap-3">
              <div
                role="progressbar"
                aria-label="Lesson progress"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 flex-1 overflow-hidden rounded-full bg-[#ece9f8]"
              >
                <div
                  className="h-full rounded-full bg-[#3558AE] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <span className="text-xs font-bold tabular-nums text-slate-500">
                {index + 1}/{slides.length}
              </span>
            </div>
          </header>

          <section className="min-h-[420px] px-5 py-8 sm:px-9">
            <div className="mx-auto max-w-xl">
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
                  {slide.type}
                </p>

                <h2 className="mt-2 text-2xl font-extrabold">
                  {slide.title}
                </h2>
              </div>

              {["introduction", "summary"].includes(
                slide.type
              ) && (
                <p className="mt-8 whitespace-pre-line text-center text-base leading-8 text-slate-600">
                  {str(content.text)}
                </p>
              )}

              {["vocabulary", "speaking"].includes(
                slide.type
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
                    {str(content.phrase)}
                  </p>

                  {str(content.romanization) && (
                    <p className="text-base font-semibold text-[#3558AE]">
                      {str(content.romanization)}
                    </p>
                  )}

                  <div className="rounded-2xl bg-[#f5f2ff] p-5">
                    <p className="text-xs font-bold uppercase text-[#3558AE]">
                      English Meaning
                    </p>

                    <p className="mt-2 text-lg font-bold">
                      {str(content.meaning)}
                    </p>

                    {str(content.usage_note) && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {str(content.usage_note)}
                      </p>
                    )}
                  </div>

                  <Speaker
                    phrase={str(content.phrase)}
                    locale={locale}
                    onError={setAudioError}
                  />

                  {slide.type === "speaking" && (
                    <p className="text-xs text-slate-500">
                      Speaking recognition and pronunciation
                      scoring are not enabled yet.
                    </p>
                  )}
                </div>
              )}

              {slide.type === "dialogue" && (
                <div className="mt-8 space-y-4">
                  <p className="text-center text-sm text-slate-600">
                    Read the conversation and tap a speaker
                    button to listen.
                  </p>

                  {[
                    {
                      speaker:
                        str(content.speaker_a) || "Speaker A",
                      line: str(content.line_a),
                    },
                    {
                      speaker:
                        str(content.speaker_b) || "Speaker B",
                      line: str(content.line_b),
                    },
                  ].map((entry, i) => (
                    <div
                      key={i}
                      className="rounded-2xl bg-[#f5f2ff] p-5"
                    >
                      <p className="text-xs font-bold uppercase text-[#3558AE]">
                        {entry.speaker}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="break-words text-lg font-bold">
                          {entry.line}
                        </p>

                        <Speaker
                          phrase={entry.line}
                          locale={
                            containsJapanese(entry.line)
                              ? "ja-JP"
                              : "en-US"
                          }
                          onError={setAudioError}
                          compact
                        />
                      </div>
                    </div>
                  ))}

                  {str(content.translation) && (
                    <div className="rounded-xl border border-[#e5e0f7] p-4">
                      <p className="text-xs font-bold text-[#3558AE]">
                        English Translation
                      </p>

                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        {str(content.translation)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {slide.type === "flashcards" && (
                <div className="mt-8 space-y-5">
                  <p className="text-center text-sm text-slate-600">
                    Tap the card to flip it.
                  </p>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setFlipped(!flipped)}
                      className="flex min-h-52 w-full flex-col items-center justify-center rounded-3xl border-2 border-[#ddd7f6] bg-[#f5f2ff] px-12 py-6 text-center"
                    >
                      <p className="text-xs font-bold uppercase text-[#3558AE]">
                        {flipped ? "Meaning" : "Expression"}
                      </p>

                      <p className="mt-5 break-words text-2xl font-extrabold">
                        {flipped
                          ? str(card.back)
                          : str(card.front)}
                      </p>
                    </button>

                    <div className="absolute right-3 top-3">
                      <Speaker
                        phrase={str(card.front)}
                        locale={
                          containsJapanese(str(card.front))
                            ? "ja-JP"
                            : "en-US"
                        }
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
                        setCardIndex(cardIndex - 1);
                        setFlipped(false);
                      }}
                      className={buttonSecondary}
                    >
                      <ChevronLeft size={17} />
                      Previous
                    </button>

                    <span className="text-sm font-bold">
                      {cardIndex + 1}/{cards.length}
                    </span>

                    <button
                      type="button"
                      disabled={cardIndex === cards.length - 1}
                      onClick={() => {
                        setCardIndex(cardIndex + 1);
                        setFlipped(false);
                      }}
                      className={buttonSecondary}
                    >
                      Next
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </div>
              )}

              {slide.type === "assessment" && (
                <PublishedKnowledgeCheck
                  lessonId={lesson.lessonId}
                  onFinished={(grade) => {
                    setResult(grade);
                    navigate(index + 1);
                    // React state updates asynchronously;
                    // advance directly after saving result.
                    setIndex((current) =>
                      Math.min(current + 1, slides.length - 1)
                    );
                  }}
                />
              )}

              {slide.type === "completion" && (
                <div className="mt-8 space-y-5 text-center">
                  <Trophy
                    size={54}
                    className="mx-auto text-[#3558AE]"
                  />

                  <h3 className="text-2xl font-extrabold">
                    Great Work, Explorer!
                  </h3>

                  {result ? (
                    <>
                      <p className="text-5xl font-extrabold text-[#3558AE]">
                        {result.score}%
                      </p>

                      <p className="text-sm text-slate-600">
                        {result.correct_count} correct out of{" "}
                        {result.question_count} questions.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600">
                      Your Knowledge Check has not been submitted.
                    </p>
                  )}

                  <div className="rounded-2xl bg-[#f5f2ff] p-5 text-sm leading-7 text-slate-600">
                    Your Knowledge Check score is saved.
                    Lesson completion, XP, coins, and unlocks
                    will be enabled in the next phase.
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        navigate(0);
                      }}
                      className={buttonSecondary}
                    >
                      <RotateCcw size={17} />
                      Review Again
                    </button>

                    <Link
                      href="/learn/published"
                      className={buttonPrimary}
                    >
                      Return to Roadmap
                      <ArrowRight size={17} />
                    </Link>
                  </div>
                </div>
              )}

              {audioError && (
                <p
                  role="status"
                  className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
                >
                  {audioError}
                </p>
              )}
            </div>
          </section>

          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 p-6">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => navigate(index - 1)}
              className={buttonSecondary}
            >
              <ArrowLeft size={17} />
              Back
            </button>

            {slide.type === "assessment" ? (
              <span className="text-xs font-semibold text-slate-500">
                Submit the Knowledge Check to continue
              </span>
            ) : index < slides.length - 1 ? (
              <button
                type="button"
                onClick={() => navigate(index + 1)}
                className={buttonPrimary}
              >
                Continue
                <ArrowRight size={17} />
              </button>
            ) : (
              <Link
                href="/learn/published"
                className={buttonSecondary}
              >
                Exit Lesson
              </Link>
            )}
          </footer>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          ACELINGUA · Secure Published Learning
        </p>
      </div>
    </main>
  );
}
