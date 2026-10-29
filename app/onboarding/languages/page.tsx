
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Compass,
  Globe2,
  Languages,
  Loader2,
} from "lucide-react";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import {
  createClient,
  createPublicClient,
} from "@/lib/supabase/client";
import { publishedCourseAvailability } from "@/lib/language-catalog";
import { withTimeout } from "@/lib/request-timeout";

type Language = {
  id: string;
  code: string;
  name: string;
  native_name: string | null;
};

type LanguageVisual = {
  greeting: string;
  romanized: string;
  intro: string;
  accent: string;
  tint: string;
  emoji: string;
  flag?: string;
};

const languageVisuals: Record<string, LanguageVisual> = {
  ja: {
    greeting: "こんにちは",
    romanized: "Konnichiwa",
    intro: "A whole new story begins with one greeting.",
    accent: "#E47D98",
    tint: "#FFE9EF",
    emoji: "🇯🇵",
    flag: "/flags/jp.png",
  },
  ko: {
    greeting: "안녕하세요",
    romanized: "Annyeonghaseyo",
    intro: "Say hello to new words and new connections.",
    accent: "#8568C8",
    tint: "#EEE6FF",
    emoji: "🇰🇷",
    flag: "/flags/kr.png",
  },
  zh: {
    greeting: "你好",
    romanized: "Nǐ hǎo",
    intro: "Start small. Discover something amazing.",
    accent: "#EA9276",
    tint: "#FFEDE3",
    emoji: "🇨🇳",
    flag: "/flags/cn.png",
  },
  es: {
    greeting: "¡Hola!",
    romanized: "Hola",
    intro: "Every conversation is a new adventure.",
    accent: "#E4A64E",
    tint: "#FFF3D8",
    emoji: "🇪🇸",
    flag: "/flags/es.png",
  },
  it: {
    greeting: "Ciao!",
    romanized: "Ciao",
    intro: "Step into a world of expressive conversations.",
    accent: "#76B8A4",
    tint: "#E0F6E9",
    emoji: "🇮🇹",
    flag: "/flags/it.png",
  },
  de: {
    greeting: "Hallo!",
    romanized: "Hallo",
    intro: "Your next great discovery starts here.",
    accent: "#7A9AC8",
    tint: "#E7EFFB",
    emoji: "🇩🇪",
    flag: "/flags/de.png",
  },
  th: {
    greeting: "สวัสดี",
    romanized: "Sawatdee",
    intro: "Take the first step into a new language.",
    accent: "#6CB6AC",
    tint: "#E0F7EF",
    emoji: "🇹🇭",
    flag: "/flags/th.png",
  },
  fr: {
    greeting: "Bonjour!",
    romanized: "Bonjour",
    intro: "A little hello can take you a long way.",
    accent: "#7CA0DD",
    tint: "#E6F0FF",
    emoji: "🇫🇷",
    flag: "/flags/fr.png",
  },
  en: {
    greeting: "Hello!",
    romanized: "Hello",
    intro: "Begin your journey, one word at a time.",
    accent: "#649ED7",
    tint: "#E5F2FF",
    emoji: "🇬🇧",
  },
  fil: {
    greeting: "Kumusta!",
    romanized: "Kumusta",
    intro: "Explore meaningful words and conversations.",
    accent: "#E5A458",
    tint: "#FFF1DE",
    emoji: "🇵🇭",
  },
  tl: {
    greeting: "Kumusta!",
    romanized: "Kumusta",
    intro: "Explore meaningful words and conversations.",
    accent: "#E5A458",
    tint: "#FFF1DE",
    emoji: "🇵🇭",
  },
};

const defaultVisual: LanguageVisual = {
  greeting: "Hello!",
  romanized: "Your first words",
  intro: "Every language opens a new world.",
  accent: "#76A7DE",
  tint: "#E8F2FF",
  emoji: "🌐",
};

function normalizeLanguage(
  value: string | null | undefined
): string {
  const input = (value ?? "").trim().toLowerCase();

  const aliases: Record<string, string> = {
    japanese: "ja",
    ja: "ja",
    jp: "ja",
    korean: "ko",
    ko: "ko",
    kr: "ko",
    mandarin: "zh",
    chinese: "zh",
    "mandarin chinese": "zh",
    zh: "zh",
    cn: "zh",
    spanish: "es",
    es: "es",
    italian: "it",
    it: "it",
    german: "de",
    de: "de",
    thai: "th",
    th: "th",
    french: "fr",
    fr: "fr",
    english: "en",
    en: "en",
    filipino: "fil",
    fil: "fil",
    tagalog: "tl",
    tl: "tl",
  };

  return aliases[input] ?? input;
}

function visualFor(language: Language): LanguageVisual {
  return (
    languageVisuals[normalizeLanguage(language.code)] ??
    defaultVisual
  );
}

function readRequestedLanguage(): string {
  const query = new URLSearchParams(window.location.search);

  const fromUrl =
    query.get("language") ||
    query.get("code") ||
    query.get("lang");

  let fromClick = "";

  try {
    fromClick =
      sessionStorage.getItem("acelingua_pending_language") ?? "";

    sessionStorage.removeItem("acelingua_pending_language");
  } catch {
    // URL parameters remain supported when storage is unavailable.
  }

  return normalizeLanguage(fromUrl || fromClick);
}

function Flag({
  language,
  small = false,
}: {
  language: Language;
  small?: boolean;
}) {
  const visual = visualFor(language);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [language.code]);

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${
        small ? "rounded-xl" : "rounded-[18px] sm:rounded-[24px]"
      } bg-white`}
    >
      {visual.flag && !failed ? (
        <Image
          src={visual.flag}
          alt={`${language.name} flag`}
          fill
          sizes={
            small
              ? "56px"
              : "(max-width: 640px) 240px, 320px"
          }
          className={`object-contain ${
            small ? "p-1" : "p-3 sm:p-5"
          }`}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          role="img"
          aria-label={`${language.name} flag`}
          className={
            small
              ? "text-[28px]"
              : "text-[clamp(64px,11dvh,100px)]"
          }
        >
          {visual.emoji}
        </span>
      )}
    </div>
  );
}

function PassportCard({
  language,
  order,
  total,
  direction,
}: {
  language: Language;
  order: number;
  total: number;
  direction: number;
}) {
  const visual = visualFor(language);

  const entering =
    direction >= 0 ? "ac-enter-right" : "ac-enter-left";

  return (
    <article
      key={language.id}
      className={`ac-passport ac-stage-card ${entering} relative mx-auto flex h-full w-full max-w-[385px] flex-col overflow-hidden rounded-[30px] border border-white/90 bg-white text-[#102452] sm:rounded-[36px]`}
      aria-label={`${language.name}, selected language`}
    >
      <div className="relative flex shrink-0 items-center justify-between gap-2 px-5 pt-[clamp(14px,2.8dvh,23px)] sm:px-7">
        <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-[#8594AD] sm:text-[10px]">
          <Compass
            size={14}
            style={{ color: visual.accent }}
          />
          Language passport
        </span>

        <span className="rounded-full border border-[#E7ECF3] px-3 py-1 text-[10px] font-extrabold text-[#74829A]">
          {String(order + 1).padStart(2, "0")} /{" "}
          {String(total).padStart(2, "0")}
        </span>
      </div>

      <div
        className="relative mx-5 mt-[clamp(9px,2dvh,18px)] flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[22px] sm:mx-7"
        style={{ backgroundColor: visual.tint }}
      >
        <div className="ac-flag-halo pointer-events-none absolute h-[72%] w-[72%] rounded-full border border-white/70" />

        <div className="ac-flag-halo-alt pointer-events-none absolute h-[92%] w-[92%] rounded-full border border-white/70" />

        <span
          className="ac-twinkle absolute bottom-[15%] right-[13%] text-xl text-white"
          style={{ animationDelay: "1.4s" }}
        >
          ✳
        </span>

        <div className="ac-flag-float relative z-10 h-[69%] max-h-[200px] w-[76%] max-w-[265px] rounded-[21px] border-[5px] border-white bg-white shadow-[0_17px_35px_rgba(16,36,82,0.14)] sm:border-[7px]">
          <Flag language={language} />
        </div>
      </div>

      <div className="relative shrink-0 px-5 pb-[clamp(13px,2.4dvh,22px)] pt-[clamp(10px,1.9dvh,19px)] text-center sm:px-7">
        <div
          className="mx-auto mb-2 flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] sm:text-[10px]"
          style={{
            backgroundColor: visual.tint,
            color: visual.accent,
          }}
        >
          <Check size={12} strokeWidth={3} />
          Your selection
        </div>

        <h2 className="truncate text-[clamp(26px,4.2dvh,37px)] font-black leading-[1.15] tracking-[-0.045em]">
          {language.name}
        </h2>

        <p className="mt-1 truncate text-[clamp(11px,1.8dvh,14px)] font-medium text-[#8290A9]">
          {language.native_name || visual.greeting}
        </p>

        <div className="mx-auto mt-[clamp(8px,1.8dvh,16px)] flex w-fit max-w-full items-center gap-2 rounded-full border border-[#E8EDF7] bg-[#F8FAFF] px-4 py-2 text-[clamp(11px,1.7dvh,13px)] font-bold text-[#3558AE]">
          <Languages size={12} strokeWidth={3} />
          <span className="truncate">
            {visual.greeting} · {visual.romanized}
          </span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute bottom-[87px] -left-[6px] h-3 w-3 rounded-full bg-[#F9FBFF]"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[87px] -right-[6px] h-3 w-3 rounded-full bg-[#F9FBFF]"
      />
    </article>
  );
}

export default function ChooseLanguagePage() {
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);

  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [continuing, setContinuing] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [availability, setAvailability] = useState<
    Record<string, boolean>
  >({});
  const [attempt, setAttempt] = useState(0);
  const [availabilityError, setAvailabilityError] = useState("");

  // The language selector owns its screen and does not scroll.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const oldHtmlOverflow = html.style.overflow;
    const oldBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = oldHtmlOverflow;
      body.style.overflow = oldBodyOverflow;
    };
  }, []);

  // Load active languages from Supabase.
  useEffect(() => {
    let cancelled = false;

    async function loadLanguages() {
      try {
        const result = await createPublicClient()
          .from("languages")
          .select("id, code, name, native_name")
          .eq("is_active", true)
          .order("name");

        if (result.error) {
          throw new Error(result.error.message);
        }

        if (cancelled) return;

        const rows: Language[] = result.data ?? [];
        setLanguages(rows);

        const requested = readRequestedLanguage();

        const index = rows.findIndex(
          (lang) =>
            normalizeLanguage(lang.code) === requested ||
            normalizeLanguage(lang.name) === requested
        );

        if (index >= 0) {
          setCurrentIndex(index);
        }
      } catch (cause) {
        if (!cancelled) {
          setMessage(
            cause instanceof Error
              ? cause.message
              : "We couldn't load languages. Please retry."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLanguages();

    void withTimeout(
      createClient().auth.getUser(),
      10000,
      "Session check timed out"
    )
      .then(({ data: { user } }) => {
        if (!cancelled) {
          setAuthenticated(Boolean(user));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const selectedLanguageId = languages[currentIndex]?.id;

  // Only allow continuing when a published course is ready.
  useEffect(() => {
    if (!selectedLanguageId) return;

    let cancelled = false;

    async function checkSelected() {
      try {
        const supabase = createPublicClient();

        let courses = await supabase
          .from("courses")
          .select("id")
          .eq("language_id", selectedLanguageId)
          .eq("status", "published")
          .order("created_at")
          .order("id")
          .limit(1)
          .maybeSingle();

        // Compatibility with older courses schemas.
        if (courses.error?.code === "42703") {
          courses = await supabase
            .from("courses")
            .select("id")
            .eq("language_id", selectedLanguageId)
            .eq("is_published", true)
            .order("created_at")
            .order("id")
            .limit(1)
            .maybeSingle();
        }

        if (courses.error) {
          throw new Error(courses.error.message);
        }

        const ready = courses.data
          ? (
              await withTimeout(
                publishedCourseAvailability(
                  supabase,
                  courses.data.id,
                  false
                ),
                20000,
                "Checking this language took too long. Please retry."
              )
            ).previewAvailable
          : false;

        if (!cancelled) {
          setAvailability((previous) => ({
            ...previous,
            [selectedLanguageId]: ready,
          }));

          setAvailabilityError("");
        }
      } catch (cause) {
        if (!cancelled) {
          setAvailabilityError(
            cause instanceof Error
              ? cause.message
              : "We couldn't check this language. Please retry."
          );
        }
      }
    }

    void checkSelected();

    return () => {
      cancelled = true;
    };
  }, [selectedLanguageId, attempt]);

  const goToLanguage = (index: number) => {
    if (languages.length === 0 || continuing) return;

    const normalized =
      (index + languages.length) % languages.length;

    if (normalized === currentIndex) return;

    setDirection(index >= currentIndex ? 1 : -1);
    setCurrentIndex(normalized);
    setAvailabilityError("");
  };

  // Arrow-key navigation.
  useEffect(() => {
    if (languages.length < 2) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (
        event.key !== "ArrowRight" &&
        event.key !== "ArrowLeft"
      ) {
        return;
      }

      event.preventDefault();

      if (continuing) return;

      const step = event.key === "ArrowRight" ? 1 : -1;

      setDirection(step);

      setCurrentIndex(
        (index) =>
          (index + step + languages.length) % languages.length
      );

      setAvailabilityError("");
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [languages.length, continuing]);

  // Integrates selection with the existing onboarding flow.
  const handleContinue = async () => {
    const language = languages[currentIndex];

    if (
      !language ||
      !availability[language.id] ||
      continuing
    ) {
      return;
    }

    try {
      setContinuing(true);

      localStorage.setItem(
        "acelingua_selected_language",
        language.code
      );
      localStorage.setItem(
        "acelingua_selected_language_id",
        language.id
      );
      localStorage.setItem(
        "acelingua_onboarding_started",
        "true"
      );

      const supabase = createClient();

      const {
        data: { user },
        error,
      } = await withTimeout(
        supabase.auth.getUser(),
        10000,
        "Your session check took too long. Please retry or sign in again."
      );

      if (error && !isAuthSessionMissingError(error)) {
        throw error;
      }

      localStorage.removeItem("acelingua_intro_completed");

      if (user) {
        localStorage.setItem(
          "acelingua_onboarding_user_id",
          user.id
        );

        localStorage.removeItem(
          "acelingua_onboarding_completed_user_id"
        );

        const { error: metadataError } =
          await supabase.auth.updateUser({
            data: {
              acelingua_onboarding: {
                languageId: language.id,
                languageCode: language.code,
                source: "direct_registration",
                introCompleted: true,
              },
            },
          });

        if (metadataError) {
          throw metadataError;
        }

        router.push("/onboarding/continue");
      } else {
        localStorage.removeItem(
          "acelingua_onboarding_user_id"
        );

        localStorage.setItem(
          "acelingua_onboarding_source",
          "guest_preview"
        );

        router.push(
          `/learn/intro?language=${encodeURIComponent(
            language.code
          )}`
        );
      }
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "We couldn't save your selection. Please try again."
      );

      setContinuing(false);
    }
  };

  const current = languages[currentIndex];

  const visual = current
    ? visualFor(current)
    : defaultVisual;

  const selectionAvailable = current
    ? availability[current.id]
    : undefined;

  const railIndexes =
    languages.length <= 5
      ? languages.map((_, index) => index)
      : [-2, -1, 0, 1, 2].map(
          (offset) =>
            (currentIndex + offset + languages.length) %
            languages.length
        );

  const customTheme = {
    "--ac-active": visual.accent,
    "--ac-tint": visual.tint,
  } as CSSProperties;

  return (
    <main
      className="ac-portal fixed inset-0 isolate flex h-[100dvh] w-full flex-col overflow-hidden text-[#102452]"
      style={customTheme}
    >
      <style jsx global>{`
        .ac-portal {
          font-synthesis: none;
          background: linear-gradient(
            124deg,
            #f9f2ff 0%,
            #e6f7ff 29%,
            #eeeafd 61%,
            #fff0e9 100%
          );
          background-size: 220% 220%;
          animation: acPortalBackgroundShift 24s
            ease-in-out infinite alternate;
        }

        @keyframes acPortalBackgroundShift {
          from { background-position: 0% 30%; }
          to { background-position: 100% 70%; }
        }

        .ac-portal .ac-dots {
          background-image: radial-gradient(
            #9eb1d0 0.8px,
            transparent 0.8px
          );
          background-size: 19px 19px;
          mask-image: linear-gradient(
            to bottom,
            transparent,
            black 30%,
            black 70%,
            transparent
          );
        }

        .ac-portal .ac-passport {
          box-shadow:
            0 26px 68px rgba(16,36,82,.14),
            0 5px 15px rgba(16,36,82,.06);
          transform-origin: center;
        }

        .ac-portal .ac-flag-float {
          animation: acFlagFloat 4.6s ease-in-out infinite;
        }

        .ac-portal .ac-twinkle {
          animation: acTwinkle 3s ease-in-out infinite;
        }

        .ac-portal .ac-enter-right {
          animation: acCardFromRight .55s
            cubic-bezier(.2,.85,.2,1) both;
        }

        .ac-portal .ac-enter-left {
          animation: acCardFromLeft .55s
            cubic-bezier(.2,.85,.2,1) both;
        }

        .ac-portal .ac-flag-halo {
          animation: acHalo 5s ease-in-out infinite;
        }

        .ac-portal .ac-flag-halo-alt {
          animation: acHalo 5s ease-in-out
            infinite reverse;
        }

        .ac-portal .ac-greeting-enter {
          animation: acGreeting .48s ease-out both;
        }

        .ac-portal .ac-rail-enter {
          animation: acGreeting .37s ease-out both;
        }

        @keyframes acFlagFloat {
          0%, 100% {
            transform: translateY(0) rotate(-2deg);
          }
          50% {
            transform: translateY(-8px) rotate(1.5deg);
          }
        }

        @keyframes acTwinkle {
          0%, 100% {
            opacity: .3;
            transform: scale(.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.16);
          }
        }

        @keyframes acHalo {
          0%, 100% {
            opacity: .4;
            transform: scale(1);
          }
          50% {
            opacity: .85;
            transform: scale(1.045);
          }
        }

        @keyframes acCardFromRight {
          from {
            opacity: 0;
            transform: translateX(45px)
              rotate(4deg) scale(.92);
          }
          to {
            opacity: 1;
            transform: translateX(0)
              rotate(0) scale(1);
          }
        }

        @keyframes acCardFromLeft {
          from {
            opacity: 0;
            transform: translateX(-45px)
              rotate(-4deg) scale(.92);
          }
          to {
            opacity: 1;
            transform: translateX(0)
              rotate(0) scale(1);
          }
        }

        @keyframes acGreeting {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ac-portal,
          .ac-portal .ac-twinkle,
          .ac-portal .ac-flag-float,
          .ac-portal .ac-enter-right,
          .ac-portal .ac-enter-left,
          .ac-portal .ac-flag-halo,
          .ac-portal .ac-flag-halo-alt,
          .ac-portal .ac-greeting-enter,
          .ac-portal .ac-rail-enter {
            animation: none !important;
          }
        }

        @media (max-height: 660px) {
          .ac-portal .ac-optional-short {
            display: none !important;
          }
        }

        @media (max-height: 550px) {
          .ac-portal .ac-shorter {
            display: none !important;
          }
        }
      `}</style>

      {/* Decorative background */}
      <div
        aria-hidden="true"
        className="ac-dots pointer-events-none absolute inset-0 opacity-[0.20]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-44 top-[4%] h-[410px] w-[410px] rounded-full bg-[#CDB8FF]/35 blur-[85px] sm:h-[600px] sm:w-[600px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 top-[18%] h-[390px] w-[440px] rounded-full bg-[#78D6FF]/40 blur-[85px] sm:h-[580px] sm:w-[580px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-25%] left-[28%] h-[420px] w-[520px] rounded-full bg-[#FFC3CD]/35 blur-[95px]"
      />

      {/* Independent onboarding header, not PublicHeader */}
      <header className="relative z-10 mx-auto flex h-[clamp(54px,9dvh,76px)] w-full max-w-[1350px] shrink-0 items-center justify-between px-4 sm:px-8 lg:px-12">
        <Link
          href="/"
          aria-label="ACELINGUA home"
          className="inline-flex shrink-0 items-center"
        >
          <Image
            src="/logoace.png"
            alt="ACELINGUA"
            width={192}
            height={76}
            priority
            className="h-auto w-[clamp(125px,16vw,184px)] object-contain"
          />
        </Link>

        <div className="flex items-center gap-2 rounded-full border border-[#E6EAF3] bg-white/90 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#6D7B98] sm:px-4 sm:text-xs">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#102452] text-[10px] text-white">
            1
          </span>
          <span className="hidden sm:inline">Step 1 of 3</span>
          <span className="sm:hidden">1 / 3</span>
          <span className="ml-1 hidden text-[#91A0B8] sm:inline">
            • Choose a language
          </span>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1300px] flex-1 flex-col px-3 pb-[clamp(10px,1.7dvh,20px)] sm:px-7 lg:px-10">
        <div className="shrink-0 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E3EAF7] bg-white/85 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#3558AE] sm:text-[10px]">
            📍 Your adventure begins here
          </div>

          <h1 className="mt-[clamp(5px,1.2dvh,12px)] text-[clamp(24px,4.5dvh,44px)] font-black leading-[1.08] tracking-[-0.045em]">
            Pick a language.{" "}
            <span className="text-[#3558AE]">
              Unlock a world.
            </span>
          </h1>

          <p className="ac-optional-short mx-auto mt-[clamp(4px,1dvh,10px)] max-w-lg text-[clamp(11px,1.8dvh,14px)] font-medium text-[#8490A6]">
            {authenticated
              ? "Your first step toward a new world — then it's time to create your avatar."
              : "Explore, play, and try a lesson before creating your account."}
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#E6F2FF]">
              <Languages
                size={36}
                className="text-[#3558AE]"
              />
            </div>

            <p className="flex items-center gap-2 text-sm font-semibold text-[#657695]">
              <Loader2
                size={16}
                className="animate-spin"
              />
              Finding your languages...
            </p>
          </div>
        ) : languages.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
            <Globe2
              size={48}
              className="text-[#3558AE]"
            />

            <p className="font-bold">
              {message ||
                "No languages are available yet."}
            </p>

            <button
              type="button"
              onClick={() => {
                setMessage("");
                setAttempt((n) => n + 1);
              }}
              className="rounded-full bg-[#102452] px-6 py-3 text-sm font-bold text-white"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Three-column language selection layout */}
            <div className="relative grid min-h-0 flex-1 grid-cols-1 items-center gap-[clamp(10px,2vw,28px)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.26fr)_minmax(0,0.9fr)]">
              {/* Left: selected destination */}
              <aside className="hidden min-w-0 flex-col items-start justify-center pl-2 lg:flex">
                <div className="rounded-full border border-[#E3E8F3] bg-white/80 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#3558AE]">
                  <span className="mr-1.5 text-[#FF9297]">
                    📍
                  </span>
                  Your first destination
                </div>

                <div className="mt-6 text-[clamp(12px,1.9dvh,15px)] font-bold text-[#7F8CA3]">
                  Say hello in...
                </div>

                <div
                  key={`name-${current.id}`}
                  className="ac-greeting-enter mt-2 max-w-full break-words text-[clamp(32px,5.7dvh,56px)] font-black leading-[1.05] tracking-[-0.055em]"
                >
                  {current.name}
                  <span style={{ color: visual.accent }}>
                    .
                  </span>
                </div>

                <div
                  key={`greeting-${current.id}`}
                  className="ac-greeting-enter mt-4 max-w-full break-words text-[clamp(20px,3.5dvh,30px)] font-extrabold"
                  style={{ color: visual.accent }}
                >
                  {visual.greeting}
                </div>

                <p
                  key={`intro-${current.id}`}
                  className="ac-greeting-enter mt-2 max-w-[245px] text-[clamp(12px,1.95dvh,15px)] font-medium leading-relaxed text-[#7888A2]"
                >
                  {visual.intro}
                </p>
              </aside>

              {/* Center: animated language passport */}
              <div
                aria-label="Swipe or use arrows to change language"
                className="relative flex h-full min-h-0 w-full items-center justify-center py-[clamp(9px,2dvh,22px)]"
                onTouchStart={(event) => {
                  touchStartX.current =
                    event.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(event) => {
                  const start = touchStartX.current;
                  touchStartX.current = null;

                  const end =
                    event.changedTouches[0]?.clientX;

                  if (
                    start == null ||
                    end == null ||
                    languages.length < 2
                  ) {
                    return;
                  }

                  if (Math.abs(end - start) > 45) {
                    goToLanguage(
                      currentIndex + (end < start ? 1 : -1)
                    );
                  }
                }}
              >
                <div className="relative z-10 h-full max-h-[470px] w-[min(71vw,385px)] min-w-0 sm:w-[min(60vw,385px)] lg:w-full">
                  <PassportCard
                    key={current.id}
                    language={current}
                    order={currentIndex}
                    total={languages.length}
                    direction={direction}
                  />
                </div>

                <button
                  type="button"
                  disabled={
                    languages.length < 2 || continuing
                  }
                  aria-label="Previous language"
                  onClick={() =>
                    goToLanguage(currentIndex - 1)
                  }
                  className="group absolute left-0 z-20 flex h-10 w-10 -translate-x-[2%] items-center justify-center rounded-full border border-[#E2E8F2] bg-white/95 text-[#102452] shadow-[0_8px_23px_rgba(16,36,82,0.11)] transition-transform hover:-translate-x-1 hover:bg-[#102452] hover:text-white disabled:opacity-35 sm:h-12 sm:w-12 lg:-left-6"
                >
                  <ArrowLeft
                    size={18}
                    strokeWidth={2.5}
                  />
                </button>

                <button
                  type="button"
                  disabled={
                    languages.length < 2 || continuing
                  }
                  aria-label="Next language"
                  onClick={() =>
                    goToLanguage(currentIndex + 1)
                  }
                  className="group absolute right-0 z-20 flex h-10 w-10 translate-x-[2%] items-center justify-center rounded-full border border-[#E2E8F2] bg-white/95 text-[#102452] shadow-[0_8px_23px_rgba(16,36,82,0.11)] transition-transform hover:translate-x-1 hover:bg-[#102452] hover:text-white disabled:opacity-35 sm:h-12 sm:w-12 lg:-right-6"
                >
                  <ArrowRight
                    size={18}
                    strokeWidth={2.5}
                  />
                </button>
              </div>

              {/* Right: quick language selection rail */}
              <aside className="hidden min-h-0 flex-col justify-center lg:flex">
                <div className="mb-3 flex items-center justify-between gap-2 pl-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8391A8]">
                    Explore languages
                  </span>

                  <Languages
                    className="text-[#3558AE]"
                    size={18}
                  />
                </div>

                <div
                  key={`rail-${current.id}`}
                  className="ac-rail-enter flex min-h-0 flex-col gap-[clamp(5px,1.2dvh,10px)]"
                >
                  {railIndexes.map((index) => {
                    const item = languages[index];
                    const itemVisual = visualFor(item);
                    const active = index === currentIndex;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => goToLanguage(index)}
                        aria-pressed={active}
                        aria-label={`Select ${item.name}`}
                        disabled={continuing}
                        className={`group flex h-[clamp(42px,7.6dvh,63px)] w-full min-w-0 items-center gap-3 rounded-2xl border px-2.5 text-left transition-all duration-300 sm:px-3 ${
                          active
                            ? "border-[#B6C8E7] bg-white shadow-[0_9px_24px_rgba(16,36,82,0.10)]"
                            : "border-transparent bg-white/45 hover:translate-x-1 hover:border-[#E4EBF7] hover:bg-white/95"
                        }`}
                      >
                        <div className="h-9 w-11 shrink-0 overflow-hidden rounded-xl border border-[#E9EDF5] bg-white shadow-sm sm:h-10 sm:w-12">
                          <Flag
                            language={item}
                            small
                          />
                        </div>

                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-[clamp(12px,1.95dvh,15px)] font-extrabold ${
                              active
                                ? "text-[#102452]"
                                : "text-[#74849F]"
                            }`}
                          >
                            {item.name}
                          </span>

                          <span
                            className="block truncate text-[10px] font-semibold"
                            style={{
                              color: active
                                ? itemVisual.accent
                                : "#9BA7BA",
                            }}
                          >
                            {active
                              ? "Selected destination"
                              : itemVisual.romanized}
                          </span>
                        </span>

                        {active ? (
                          <Check
                            size={16}
                            className="shrink-0 text-[#3558AE]"
                            strokeWidth={3}
                          />
                        ) : (
                          <ChevronRight
                            size={15}
                            className="shrink-0 text-[#ACB8C8] opacity-0 transition group-hover:opacity-100"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="ac-optional-short mt-4 pl-3 text-[11px] font-medium text-[#96A2B3]">
                  Use ← → keys or choose a language
                </p>
              </aside>
            </div>

            {/* Errors and retry */}
            {message || availabilityError ? (
              <div
                role="alert"
                className="mx-auto mb-2 flex w-full max-w-[660px] shrink-0 items-center justify-between gap-3 rounded-xl border border-[#F8D8DA] bg-[#FFF6F5] px-3 py-2 text-xs text-[#BB4660]"
              >
                <span className="line-clamp-2">
                  {message || availabilityError}
                </span>

                <button
                  type="button"
                  className="shrink-0 rounded-full bg-white px-3 py-1.5 font-extrabold"
                  onClick={() => {
                    setMessage("");
                    setAvailabilityError("");
                    setAttempt((n) => n + 1);
                  }}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {/* Mobile language indicators */}
            <div
              className="flex shrink-0 items-center justify-center gap-2 py-[clamp(3px,0.8dvh,7px)] lg:hidden"
              aria-label="Choose language"
            >
              {languages.map((lang, index) => (
                <button
                  key={lang.id}
                  type="button"
                  aria-label={`Select ${lang.name}`}
                  aria-pressed={currentIndex === index}
                  onClick={() => goToLanguage(index)}
                  disabled={continuing}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentIndex === index
                      ? "w-7 bg-[#3558AE]"
                      : "w-2 bg-[#C5D2E3] hover:bg-[#9BB1D1]"
                  }`}
                />
              ))}
            </div>

            {/* Continue to onboarding or guest preview */}
            <div className="flex shrink-0 flex-col items-center pb-[clamp(0px,0.6dvh,5px)] pt-[clamp(5px,1dvh,12px)]">
              <button
                type="button"
                disabled={
                  continuing || !selectionAvailable
                }
                onClick={handleContinue}
                className="group relative flex h-[clamp(43px,6.5dvh,55px)] w-[min(88vw,326px)] shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-[#102452] px-5 text-[clamp(12px,1.9dvh,14px)] font-black text-white shadow-[0_10px_26px_rgba(16,36,82,0.23)] transition hover:-translate-y-0.5 hover:bg-[#3558AE] disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0"
              >
                {continuing ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                    Continuing...
                  </>
                ) : (
                  <>
                    <span className="truncate">
                      {selectionAvailable === undefined
                        ? "Checking availability..."
                        : selectionAvailable
                          ? `Let's learn ${current.name}!`
                          : "Course in preparation"}
                    </span>

                    {selectionAvailable ? (
                      <ArrowRight
                        size={18}
                        className="shrink-0 transition-transform group-hover:translate-x-1"
                      />
                    ) : null}
                  </>
                )}
              </button>

              <p className="ac-shorter mt-[clamp(5px,1dvh,10px)] text-center text-[clamp(10px,1.5dvh,12px)] font-semibold text-[#91A0B4]">
                {authenticated
                  ? "Next: create your avatar and start exploring"
                  : "Free preview lesson • No account required"}
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
