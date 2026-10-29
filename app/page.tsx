"use client";

import { useEffect, useRef, useState } from "react";

import type { PointerEvent } from "react";

import Image from "next/image";

import Link from "next/link";

import ACELinguaWelcome from "@/components/ACELinguaWorld";

const ACE_IMAGE = "/icon%20head.png";

const VIDEO_SOURCE = "/videos/ACELingua.mp4";

const languages = [

  { code: "ja", name: "Japanese", icon: "/flags/jp.png", greeting: "Konnichiwa!", theme: "yellow" },

  { code: "ko", name: "Korean", icon: "/flags/kr.png", greeting: "Annyeonghaseyo", theme: "blue" },

  { code: "es", name: "Spanish", icon: "/flags/es.png", greeting: "¡Hola!", theme: "peach" },

  { code: "it", name: "Italian", icon: "/flags/it.png", greeting: "Ciao!", theme: "mint" },

  { code: "zh", name: "Mandarin", icon: "/flags/cn.png", greeting: "Nǐ hǎo!", theme: "pink" },

  { code: "fr", name: "French", icon: "/flags/fr.png", greeting: "Bonjour!", theme: "lavender" },

  { code: "de", name: "German", icon: "/flags/de.png", greeting: "Hallo!", theme: "yellow" },

  { code: "th", name: "Thai", icon: "/flags/th.png", greeting: "Sawasdee!", theme: "blue" },

] as const;

const steps = [

  {

    number: "01",

    icon: "fa-book-open",

    title: "Choose your language",

    description: "Pick the language that inspires you and begin your own adventure.",

  },

  {

    number: "02",

    icon: "fa-headphones",

    title: "Learn by doing",

    description: "Listen, speak, match and solve fun, bite-sized activities.",

  },

  {

    number: "03",

    icon: "fa-earth-asia",

    title: "Unlock new worlds",

    description: "Build your streak, earn rewards and explore as you grow.",

  },

] as const;

function Arrow({ diagonal = false }: { diagonal?: boolean }) {

  return (

    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"

      strokeLinecap="round" strokeLinejoin="round">

      {diagonal ? <path d="M5 19 19 5M8 5h11v11" /> : <path d="M4 12h16m-7-7 7 7-7 7" />}

    </svg>

  );

}

function LanguageBubble({ language }: { language: (typeof languages)[number] }) {

  return (

    <Link href="/languages" className={`ace-scene__bubble ace-scene__bubble--${language.theme}`}

      aria-label={`Explore ${language.name}`}>

      <span className="ace-scene__flag">

        <Image src={language.icon} alt={`${language.name} flag`} width={29} height={29}

          sizes="29px" className="ace-scene__flag-image" />

      </span>

      <span className="ace-scene__bubble-text">

        <strong>{language.greeting}</strong>

        <small>{language.name}</small>

      </span>

    </Link>

  );

}

function handleCardMove(event: PointerEvent<HTMLDivElement>) {

  if (event.pointerType === "touch") return;

  const element = event.currentTarget;

  const rect = element.getBoundingClientRect();

  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));

  const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

  element.style.setProperty("--ace-tilt-x", `${((0.5 - y) * 18).toFixed(2)}deg`);

  element.style.setProperty("--ace-tilt-y", `${((x - 0.5) * 18).toFixed(2)}deg`);

  element.style.setProperty("--ace-pointer-x", `${(x * 100).toFixed(2)}%`);

  element.style.setProperty("--ace-pointer-y", `${(y * 100).toFixed(2)}%`);

}

function handleCardLeave(event: PointerEvent<HTMLDivElement>) {

  const element = event.currentTarget;

  element.style.setProperty("--ace-tilt-x", "0deg");

  element.style.setProperty("--ace-tilt-y", "0deg");

  element.style.setProperty("--ace-pointer-x", "50%");

  element.style.setProperty("--ace-pointer-y", "50%");

}

function InteractiveAceCard() {

  return (

    <div className="ace-scene__center">

      <div className="ace-scene__tilt" onPointerMove={handleCardMove}

        onPointerLeave={handleCardLeave} onPointerCancel={handleCardLeave}>

        <div className="ace-scene__card">

          <span className="ace-scene__card-glare" aria-hidden="true" />

          <span className="ace-scene__card-light" aria-hidden="true" />

          <div className="ace-scene__card-corners" aria-hidden="true">

            <span /><span /><span /><span />

          </div>

          <div className="ace-scene__card-particles" aria-hidden="true">

            {Array.from({ length: 6 }, (_, i) => <span key={i} />)}

          </div>

          <div className="ace-scene__card-content">

            <div className="ace-scene__portrait-wrap">

              <span className="ace-scene__portrait-halo" aria-hidden="true" />

              <Image src={ACE_IMAGE} alt="Ace, your ACELINGUA learning buddy"

                width={245} height={245} priority sizes="(max-width: 680px) 180px, 225px"

                className="ace-scene__portrait" />

            </div>

            <h1 id="ace-scene-title" className="ace-scene__title">Say Hi to ACE!</h1>

          </div>

        </div>

      </div>

    </div>

  );

}

function LandingHero() {

  return (

    <section id="home-hero" className="ace-scene" aria-labelledby="ace-scene-title">

      <div className="ace-scene__inner">

        <div className="ace-scene__stage">

          <div className="ace-scene__glow" aria-hidden="true" />

          <div className="ace-scene__orbit ace-scene__orbit--outer" aria-hidden="true" />

          <div className="ace-scene__orbit ace-scene__orbit--inner" aria-hidden="true" />

          <InteractiveAceCard />

          <div className="ace-scene__languages" aria-label="Language greetings">

            {languages.map(language => <LanguageBubble key={language.code} language={language} />)}

          </div>

        </div>

        <Link href="/onboarding/languages" className="ace-scene__explore">View Languages <Arrow /></Link>

      </div>

    </section>

  );

}

function CinemaSection() {
  const screenRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inViewRef = useRef(false);
  const manualPauseRef = useRef(false);
  const visibilityPauseRef = useRef(false);

  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const screen = screenRef.current;
    const video = videoRef.current;
    if (!screen || !video) return;

    // Autoplay with sound is blocked by most browsers.
    video.muted = true;

    const playWhenVisible = () => {
      if (
        document.hidden ||
        !inViewRef.current ||
        manualPauseRef.current ||
        video.ended ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      void video.play().catch(() => {
        // If the browser blocks autoplay, the video stays manually playable.
      });
    };

    const pauseWhenHidden = () => {
      if (video.paused) return;
      visibilityPauseRef.current = true;
      video.pause();
    };

    // Start once about half the actual screen is visible (not when just the
    // section heading enters the viewport). Pause when the user scrolls away.
    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        if (inViewRef.current) playWhenVisible();
        else pauseWhenHidden();
      },
      {
        rootMargin: "-72px 0px -24px 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    const onVisibilityChange = () => {
      if (document.hidden) pauseWhenHidden();
      else playWhenVisible();
    };

    observer.observe(screen);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const playVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    manualPauseRef.current = false;
    void video.play().catch(() => {
      // Keep native controls accessible if playback cannot start.
    });
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <section className="ace-cinema" aria-label="How ACELINGUA works">
      <div className="ace-cinema__inner">
        <div className="ace-cinema__heading">
          <span className="ace-home__kicker">
            <i className="fa-solid fa-clapperboard" aria-hidden="true" /> HOW IT WORKS
          </span>
          <p>Watch, learn, and explore what awaits you.</p>
        </div>

        <div id="how-it-works" className="ace-cinema__theater">
          <div className="ace-cinema__topline" aria-hidden="true">
            <span className="ace-cinema__topline-trail">LEARN · SPEAK · EXPLORE</span>
          </div>

          <div ref={screenRef} className="ace-cinema__screen">
            <video
              ref={videoRef}
              className="ace-cinema__video"
              controls
              muted
              playsInline
              preload="metadata"
              aria-label="ACELINGUA introduction video"
              onPlay={() => {
                manualPauseRef.current = false;
                setStarted(true);
                setIsPlaying(true);
              }}
              onPause={() => {
                setIsPlaying(false);
                if (visibilityPauseRef.current) {
                  visibilityPauseRef.current = false;
                } else if (!videoRef.current?.ended) {
                  manualPauseRef.current = true;
                }
              }}
              onEnded={() => setIsPlaying(false)}
              onVolumeChange={() => {
                if (videoRef.current) setIsMuted(videoRef.current.muted);
              }}
              onError={() => setVideoError(true)}
            >
              <source src={VIDEO_SOURCE} type="video/mp4" />
              Your browser does not support HTML5 video.
            </video>

            {!started && !videoError && (
              <button
                type="button"
                className="ace-cinema__play-overlay"
                onClick={playVideo}
                aria-label="Play the ACELINGUA introduction video"
              >
                <span className="ace-cinema__play-aura" aria-hidden="true" />
                <span className="ace-cinema__play-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="m8 5 11 7-11 7V5Z" />
                  </svg>
                </span>
                <span className="ace-cinema__play-title">Welcome to ACELINGUA</span>
                <span className="ace-cinema__play-subtitle">
                  Plays automatically when you scroll into view
                </span>
              </button>
            )}

            {videoError && (
              <p className="ace-cinema__error" role="alert">
                Video could not load. Check <code>public/videos/ACELingua.mp4</code>.
              </p>
            )}
          </div>

          <div className="ace-cinema__underbar">
            <div className="ace-cinema__underbar-info">
              <span className={`ace-cinema__status-dot${isPlaying ? " ace-cinema__status-dot--playing" : ""}`} aria-hidden="true" />
              <span>
                <strong>Discover how learning comes to life</strong>
                <small>{isPlaying ? "Now playing · Your ACELINGUA preview" : "Your ACELINGUA video tour"}</small>
              </span>
            </div>
            <button
              type="button"
              className="ace-cinema__sound-toggle"
              onClick={toggleSound}
              aria-label={isMuted ? "Turn video sound on" : "Mute video sound"}
              aria-pressed={!isMuted}
            >
              <i className={`fa-solid ${isMuted ? "fa-volume-xmark" : "fa-volume-high"}`} aria-hidden="true" />
              <span>{isMuted ? "Turn sound on" : "Sound on"}</span>
            </button>
          </div>
        </div>

        <div className="ace-cinema__steps" aria-label="How ACELINGUA works">
          {steps.map((step) => (
            <article key={step.number} className="ace-cinema__step">
              <div className="ace-cinema__step-header">
                <span className="ace-cinema__step-number">{step.number}</span>
                <span className="ace-cinema__step-icon" aria-hidden="true">
                  <i className={`fa-solid ${step.icon}`} />
                </span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const aceGreetings = [
  {
    language: "ENGLISH",
    title: "Hi there, explorer!",
    subtitle: "I'm ACE. Let's learn together!",
  },
  {
    language: "JAPANESE",
    title: "Konnichiwa!",
    subtitle: "Every adventure starts with hello.",
  },
  {
    language: "SPANISH",
    title: "¡Hola, amigo!",
    subtitle: "Ready for a little adventure?",
  },
  {
    language: "FRENCH",
    title: "Bonjour!",
    subtitle: "You're doing wonderfully already.",
  },
  {
    language: "KOREAN",
    title: "Annyeong!",
    subtitle: "One word at a time. You've got this!",
  },
] as const;

function MeetAceSection() {
  const [greetingIndex, setGreetingIndex] = useState(0);
  const greeting = aceGreetings[greetingIndex];

  const nextGreeting = () => {
    setGreetingIndex((current) => (current + 1) % aceGreetings.length);
  };

  return (
    <section id="meet-ace" className="ace-about" aria-labelledby="ace-meet-title">
      <div className="ace-about__inner">
        <div className="ace-about__main">
          <div className="ace-about__intro">
            <span className="ace-about__eyebrow">
              <span className="ace-about__eyebrow-line" aria-hidden="true" />
              A FRIEND ALONG THE WAY WITH YOU
            </span>

            <h2 id="ace-meet-title" className="ace-about__heading">
              Meet <span className="ace-about__ace"><span className="ace-footer__letter--a">A</span>
              <span className="ace-footer__letter--c">C</span>
              <span className="ace-footer__letter--e">E</span>
              🐾</span>
              <br />
            </h2>

            <p className="ace-about__description">
              New language, new beginnings. ACE is ACELINGUA&apos;s curious cat
              buddy, here to make every practice session feel more welcoming.
              Discover a new phrase, try again, and enjoy the progress you make
              along the way.
            </p>

            <p className="ace-about__promise">
              YOUR PACE. YOUR PROGRESS. YOUR NEXT HELLO.
            </p>
          </div>

          <div className="ace-about__visual">
            <div className="ace-about__stage">
              <div className="ace-about__ring ace-about__ring--outer" aria-hidden="true" />
              <div className="ace-about__ring ace-about__ring--inner" aria-hidden="true" />

              <div className="ace-about__portrait-disc">
                <Image
                  src={ACE_IMAGE}
                  alt="ACE, ACELINGUA's friendly cat mascot"
                  width={410}
                  height={410}
                  sizes="(max-width: 680px) 270px, (max-width: 1000px) 300px, 370px"
                  className="ace-about__portrait"
                />
              </div>

              <div className="ace-about__speech" aria-live="polite" aria-atomic="true">
                <span className="ace-about__speech-language">ACE SAYS · {greeting.language}</span>
                <strong>{greeting.title}</strong>
                <span className="ace-about__speech-subtitle">{greeting.subtitle}</span>
              </div>
            </div>

            <button
              type="button"
              className="ace-about__greet"
              onClick={nextGreeting}
              aria-label={`Say hello to ACE in another language. Currently ${greeting.language.toLowerCase()}.`}
            >
              <span className="ace-about__greet-icon" aria-hidden="true">
                <i className="fa-regular fa-comment-dots" />
              </span>
              Say hello to ACE
              <Arrow />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function LanguageShowcase() {
  const totalLanguages = String(languages.length).padStart(2, "0");

  return (
    <section className="ace-langline" aria-labelledby="ace-langline-title">
      <div className="ace-langline__inner">
        <div className="ace-langline__intro">
          <div className="ace-langline__count-group">
            <strong className="ace-langline__count">{totalLanguages}</strong>
            <div>
              <h2 id="ace-langline-title">Languages to explore.</h2>
              <p>Here is the Language that speaks to you.</p>
            </div>
          </div>
        </div>
        <div className="ace-langline__list" aria-label="Available language choices">
          {languages.map((language) => (
            <Link href="/" className="ace-langline__item" key={language.code}>
              <Image
                src={language.icon}
                alt=""
                width={32}
                height={32}
                sizes="32px"
                className="ace-langline__flag"
              />
              <span>{language.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const learnerBenefits = [
  {
    number: "01",
    kicker: "EASY TO START",
    title: "Little lessons. Real progress.",
    description:
      "Build confidence with manageable lessons and a learning path you can return to anytime.",
  },
  {
    number: "02",
    kicker: "LEARN BY DOING",
    title: "Practice beyond memorizing.",
    description:
      "Listen, match, translate, and put new words together through interactive activities.",
  },
  {
    number: "03",
    kicker: "STAY MOTIVATED",
    title: "Turn effort into momentum.",
    description:
      "Follow your progress, build streaks, and earn rewards as you move through your course.",
  },
] as const;

function BenefitsSection() {
  return (
    <section className="ace-benefits" aria-labelledby="ace-benefits-title">
      <div className="ace-benefits__inner">
        <div className="ace-benefits__heading">
          <span className="ace-benefits__eyebrow">WHY LEARN WITH ACELINGUA</span>
          <h2 id="ace-benefits-title">Made for progress, <span>not pressure.</span></h2>
          <p>Language learning should feel possible, rewarding, and genuinely fun.</p>
        </div>

        <div className="ace-benefits__list" aria-label="Three benefits of ACELINGUA">
          {learnerBenefits.map((benefit) => (
            <article className="ace-benefits__item" key={benefit.number}>
              <div className="ace-benefits__meta">
                <span className="ace-benefits__number">{benefit.number}</span>
                <span className="ace-benefits__kicker">{benefit.kicker}</span>
              </div>
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BackToTop() {

  const [visible, setVisible] = useState(false);

  useEffect(() => {

    let frame: number | null = null;

    const update = () => {

      frame = null;

      const hero = document.getElementById("home-hero");

      setVisible(hero ? hero.getBoundingClientRect().bottom <= 115 : window.scrollY > 500);

    };

    const onScroll = () => {

      if (frame === null) frame = window.requestAnimationFrame(update);

    };

    update();

    window.addEventListener("scroll", onScroll, { passive: true });

    window.addEventListener("resize", onScroll);

    return () => {

      window.removeEventListener("scroll", onScroll);

      window.removeEventListener("resize", onScroll);

      if (frame !== null) window.cancelAnimationFrame(frame);

    };

  }, []);

  const scrollToTop = () => {

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });

  };

  return (

    <button type="button" className={`ace-backtop${visible ? " ace-backtop--visible" : ""}`}

      onClick={scrollToTop} aria-label="Back to top" aria-hidden={!visible}

      tabIndex={visible ? 0 : -1}>

      <span className="ace-backtop__icon" aria-hidden="true">

        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"

          strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m-7 7 7-7 7 7" /></svg>

      </span>

      <span className="ace-backtop__label">Back to top</span>

    </button>

  );

}

export default function HomePage() {

  useEffect(() => {
    // Animate secondary content as it reaches the viewport.
    // The first-fold hero uses a timed CSS-only stagger on page entry.
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const selector = [
      ".ace-cinema__heading",
      ".ace-cinema__theater",
      ".ace-cinema__step",
      ".ace-about__eyebrow",
      ".ace-about__heading",
      ".ace-about__description",
      ".ace-about__promise",
      ".ace-about__visual",
      ".ace-langline__intro",
      ".ace-langline__item",
      ".ace-benefits__heading",
      ".ace-benefits__item",
      ".ace-footer__identity",
      ".ace-footer__nav-group",
    ].join(", ");

    const elements = document.querySelectorAll<HTMLElement>(
      `.ace-home ${selector.split(", ").join(", .ace-home ")}`
    );

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("ace-is-visible");
          currentObserver.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );

    elements.forEach((element) => {
      element.classList.add("ace-scroll-reveal");
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      elements.forEach((element) => {
        element.classList.remove("ace-scroll-reveal", "ace-is-visible");
      });
    };
  }, []);

  return (

    <main id="main-content" className="ace-home">

      <ACELinguaWelcome />

      <LandingHero />

      <CinemaSection />

      <MeetAceSection />

      <LanguageShowcase />

      <BenefitsSection />

      <footer className="ace-footer">

        <div className="ace-footer__main">
          <div className="ace-footer__identity">
            <Link href="/" className="ace-footer__wordmark" aria-label="ACELINGUA home">
              <span className="ace-footer__letter--a">A</span>
              <span className="ace-footer__letter--c">C</span>
              <span className="ace-footer__letter--e">E</span>
              <span>lingua</span>
            </Link>
            <p>Learn. Speak. Explore.</p>
            <span className="ace-footer__identity-note">A FRIENDLIER WAY TO FIND YOUR WORDS.</span>
          </div>

          <nav className="ace-footer__nav" aria-label="Footer navigation">
            <div className="ace-footer__nav-group">
              <h3>EXPLORE</h3>
              <Link href="/languages">Languages</Link>
              <Link href="/#how-it-works">How it works</Link>
              <Link href="/#meet-ace">Meet ACE</Link>
            </div>
            <div className="ace-footer__nav-group">
              <h3>YOUR JOURNEY</h3>
              <Link href="/register">Get started</Link>
              <Link href="/login">Log in</Link>
            </div>
            <div className="ace-footer__nav-group">
              <h3>ACELINGUA</h3>
              <Link href="/">Home</Link>
            </div>
          </nav>
        </div>

        <div className="ace-footer__bottom">
          <span>© 2026 ACELINGUA. All rights reserved.</span>
          <span>MADE FOR THE ACE LIKE YOU.</span>
        </div>
      </footer>

      <BackToTop />

      <style>{`

        .ace-home { position:relative; color:#2a255c; overflow:clip; }

        .ace-home #how-it-works, .ace-home #meet-ace { scroll-margin-top:96px; }

        .ace-home * { box-sizing:border-box; }

        .ace-home__kicker { display:inline-flex; align-items:center; gap:9px; font-size:11px; font-weight:800; letter-spacing:.16em; color:#9270c1; }

        .ace-home__destination h2 { margin:14px 0; font-size:clamp(30px,4vw,52px); line-height:1.13; letter-spacing:-.035em; font-weight:850; }

        .ace-home__destination h2 span { color:#b64074; }

        .ace-home__destination p { color:#706a8d; line-height:1.8; font-size:15px; }

        /* FIRST FOLD: ACE + FIXED COMIC BUBBLES */

        .ace-scene { position:relative; isolation:isolate; display:flex; align-items:center; justify-content:center; width:100%; min-height:calc(100svh - 94px); padding:12px 24px 20px; }

        .ace-scene__inner { display:flex; flex-direction:column; align-items:center; justify-content:center; width:min(100%,1160px); margin:0 auto; }

        .ace-scene__stage { position:relative; isolation:isolate; flex:none; width:100%; height:500px; }

        .ace-scene__glow { position:absolute; z-index:-2; top:50%; left:50%; width:430px; max-width:100%; aspect-ratio:1; border-radius:50%; transform:translate(-50%,-50%); background:radial-gradient(circle,#fff 0%,rgba(241,224,255,.6) 48%,transparent 78%); filter:blur(16px); pointer-events:none; }

        .ace-scene__orbit { position:absolute; z-index:-1; top:50%; left:50%; border-radius:50%; transform:translate(-50%,-50%); pointer-events:none; }

        .ace-scene__orbit--outer { width:440px; height:440px; max-width:100%; border:1px dashed rgba(103,95,166,.18); }

        .ace-scene__orbit--inner { width:340px; height:340px; max-width:80%; border:1px solid rgba(103,95,166,.11); }

        .ace-scene__center { position:absolute; top:87px; left:50%; z-index:3; width:285px; transform:translateX(-50%); }

        .ace-scene__tilt { --ace-tilt-x:0deg; --ace-tilt-y:0deg; --ace-pointer-x:50%; --ace-pointer-y:50%; --ace-lift:0px; perspective:900px; touch-action:pan-y; }

        .ace-scene__tilt:hover { --ace-lift:-5px; }

        .ace-scene__card { position:relative; isolation:isolate; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; min-height:320px; padding:22px 18px; overflow:hidden; border:1.5px solid rgba(255,255,255,.94); border-radius:30px; background:radial-gradient(ellipse at 18% 12%,rgba(255,234,246,.84),transparent 60%),radial-gradient(ellipse at 86% 84%,rgba(220,233,255,.82),transparent 65%),linear-gradient(145deg,rgba(255,255,255,.95),rgba(250,244,255,.86) 48%,rgba(235,242,255,.87)); box-shadow:0 25px 65px rgba(89,74,150,.13),0 9px 24px rgba(106,116,194,.07),inset 0 2px 0 #fff; backdrop-filter:blur(20px) saturate(145%); transform:rotateX(var(--ace-tilt-x)) rotateY(var(--ace-tilt-y)) translateY(var(--ace-lift)); backface-visibility:hidden; transition:transform 110ms ease-out,box-shadow .35s ease,border-color .35s ease; }

        .ace-scene__tilt:not(:hover) .ace-scene__card { transition:transform 550ms cubic-bezier(.22,1,.36,1),box-shadow .4s ease; }

        .ace-scene__tilt:hover .ace-scene__card { border-color:rgba(197,177,235,.9); box-shadow:0 36px 78px rgba(99,81,172,.2),0 17px 35px rgba(135,145,222,.14),inset 0 2px 0 #fff; }

        .ace-scene__card-glare { position:absolute; z-index:3; inset:0; border-radius:inherit; opacity:0; pointer-events:none; background:radial-gradient(circle at var(--ace-pointer-x) var(--ace-pointer-y),rgba(255,255,255,.85),rgba(255,255,255,.38) 18%,transparent 66%); transition:opacity .28s ease; }

        .ace-scene__tilt:hover .ace-scene__card-glare { opacity:.78; }

        .ace-scene__card-light { position:absolute; z-index:0; inset:-25%; pointer-events:none; background:radial-gradient(circle at 20% 28%,rgba(249,195,215,.35),transparent 40%),radial-gradient(circle at 83% 72%,rgba(166,200,255,.36),transparent 43%); filter:blur(21px); transition:transform .65s ease; }

        .ace-scene__tilt:hover .ace-scene__card-light { transform:scale(1.12); }

        .ace-scene__card-corners { position:absolute; z-index:2; inset:0; pointer-events:none; }

        .ace-scene__card-corners span { position:absolute; width:19px; height:19px; border:2px solid rgba(141,128,199,.25); }

        .ace-scene__card-corners span:nth-child(1) { top:14px;left:14px;border-right:0;border-bottom:0;border-top-left-radius:7px; }

        .ace-scene__card-corners span:nth-child(2) { top:14px;right:14px;border-left:0;border-bottom:0;border-top-right-radius:7px; }

        .ace-scene__card-corners span:nth-child(3) { bottom:14px;left:14px;border-right:0;border-top:0;border-bottom-left-radius:7px; }

        .ace-scene__card-corners span:nth-child(4) { bottom:14px;right:14px;border-left:0;border-top:0;border-bottom-right-radius:7px; }

        .ace-scene__card-content { position:relative; z-index:4; display:flex; flex-direction:column; align-items:center; width:100%; text-align:center; }

        .ace-scene__portrait-wrap { position:relative; display:grid; place-items:center; width:100%; margin-top:11px; }

        .ace-scene__portrait-halo { position:absolute; width:183px; height:183px; border-radius:50%; background:radial-gradient(circle,#fff,rgba(233,218,252,.48) 52%,transparent 76%); filter:blur(11px); transition:transform .4s ease; }

        .ace-scene__portrait { position:relative; z-index:2; display:block; width:220px; max-width:100%; height:auto; object-fit:contain; filter:drop-shadow(0 11px 12px rgba(93,83,159,.1)); transition:transform .38s cubic-bezier(.22,1,.36,1); }

        .ace-scene__tilt:hover .ace-scene__portrait { transform:translateY(-6px) scale(1.045); }

        .ace-scene__tilt:hover .ace-scene__portrait-halo { transform:scale(1.16); }

        .ace-scene__title { margin:9px 0 0; color:#2a255c; font-size:25px; font-weight:800; line-height:1.2; transition:transform .3s ease; }

        .ace-scene__tilt:hover .ace-scene__title { transform:translateY(-3px); }

        .ace-scene__card-particles { position:absolute; z-index:2; inset:0; overflow:hidden; pointer-events:none; }

        .ace-scene__card-particles span { position:absolute; width:4px; height:4px; border-radius:50%; background:#b899db; opacity:0; }

        .ace-scene__card-particles span:nth-child(1) { top:20%;left:15%;--move-x:18px;--move-y:-25px; }

        .ace-scene__card-particles span:nth-child(2) { top:68%;right:15%;background:#9ac7f1;--move-x:-18px;--move-y:-25px; }

        .ace-scene__card-particles span:nth-child(3) { top:34%;right:18%;background:#eab0d0;--move-x:13px;--move-y:-31px; }

        .ace-scene__card-particles span:nth-child(4) { bottom:21%;left:16%;--move-x:-15px;--move-y:-21px; }

        .ace-scene__card-particles span:nth-child(5) { top:57%;left:10%;background:#a6c8ff;--move-x:18px;--move-y:20px; }

        .ace-scene__card-particles span:nth-child(6) { top:16%;right:30%;background:#e5b2d0;--move-x:-11px;--move-y:-22px; }

        .ace-scene__tilt:hover .ace-scene__card-particles span { animation:ace-particle-float 2.6s ease-in-out infinite; }

        .ace-scene__card-particles span:nth-child(2) { animation-delay:.25s; }

        .ace-scene__card-particles span:nth-child(3) { animation-delay:.5s; }

        .ace-scene__card-particles span:nth-child(4) { animation-delay:.75s; }

        .ace-scene__card-particles span:nth-child(5) { animation-delay:1s; }

        .ace-scene__card-particles span:nth-child(6) { animation-delay:1.25s; }

        @keyframes ace-particle-float { 0% {opacity:0;transform:translate(0,0) scale(.7);} 35% {opacity:.8;} 70% {opacity:.55;} 100% {opacity:0;transform:translate(var(--move-x),var(--move-y)) scale(1.5);} }

        .ace-scene__languages { position:absolute; z-index:5; inset:0; pointer-events:none; }

        .ace-scene__bubble { position:absolute; display:flex; align-items:center; gap:9px; width:170px; min-height:54px; padding:8px 10px; border:2px solid #2a255c; border-radius:14px; background:var(--bubble-bg,#fff8e9); box-shadow:3px 4px 0 #2a255c; color:#2a255c; text-decoration:none; pointer-events:auto; transform:rotate(var(--angle,0deg)); transition:transform .25s ease,box-shadow .25s ease; }

        .ace-scene__bubble:hover { z-index:10; transform:translateY(-4px) rotate(0deg) scale(1.04); box-shadow:5px 6px 0 #2a255c; }

        .ace-scene__bubble::after { position:absolute; top:calc(50% - 5px); width:11px; height:11px; background:inherit; content:""; }

        .ace-scene__bubble:nth-child(odd)::after { right:-7px; border-top:2px solid #2a255c; border-right:2px solid #2a255c; transform:rotate(45deg); }

        .ace-scene__bubble:nth-child(even)::after { left:-7px; border-bottom:2px solid #2a255c; border-left:2px solid #2a255c; transform:rotate(45deg); }

        .ace-scene__bubble:nth-child(1) { top:24px;left:8%;--angle:-5deg; }

        .ace-scene__bubble:nth-child(2) { top:85px;right:7%;--angle:4deg; }

        .ace-scene__bubble:nth-child(3) { top:170px;left:1%;--angle:3deg; }

        .ace-scene__bubble:nth-child(4) { top:246px;right:2%;--angle:-4deg; }

        .ace-scene__bubble:nth-child(5) { top:310px;left:8%;--angle:-3deg; }

        .ace-scene__bubble:nth-child(6) { top:327px;right:11%;--angle:5deg; }

        .ace-scene__bubble:nth-child(7) { top:413px;left:2%;--angle:4deg; }

        .ace-scene__bubble:nth-child(8) { top:423px;right:3%;--angle:-4deg; }

        .ace-scene__bubble--yellow { --bubble-bg:#fff2d3; }

        .ace-scene__bubble--blue { --bubble-bg:#dff0ff; }

        .ace-scene__bubble--pink { --bubble-bg:#ffe4ee; }

        .ace-scene__bubble--peach { --bubble-bg:#ffe9da; }

        .ace-scene__bubble--lavender { --bubble-bg:#ece3ff; }

        .ace-scene__bubble--mint { --bubble-bg:#e0f6e9; }

        .ace-scene__flag { display:flex; align-items:center; justify-content:center; flex-shrink:0; width:32px; height:32px; padding:2px; border:1px solid rgba(42,37,92,.07); border-radius:10px; background:rgba(255,255,255,.76); }

        .ace-scene__flag-image { display:block; width:100%; height:100%; object-fit:contain; border-radius:6px; transition:transform .25s ease; }

        .ace-scene__bubble:hover .ace-scene__flag-image { transform:scale(1.08); }

        .ace-scene__bubble-text { display:flex; flex-direction:column; gap:3px; min-width:0; }

        .ace-scene__bubble-text strong { font-size:11px; font-weight:800; line-height:1.25; overflow-wrap:anywhere; }

        .ace-scene__bubble-text small { font-size:9px; color:#6c6484; }

        .ace-scene__explore { display:inline-flex; align-items:center; justify-content:center; gap:10px; flex-shrink:0; min-height:40px; margin-top:5px; padding:8px 18px; border:1px solid transparent; border-radius:30px; color:#3558ae; background:transparent; font-size:13px; font-weight:700; text-decoration:none; backdrop-filter:blur(0); transition:color .3s,background .3s,border-color .3s,backdrop-filter .35s,box-shadow .35s,transform .3s; }

        .ace-scene__explore svg { display:block; width:17px; height:17px; transition:transform .3s cubic-bezier(.22,1,.36,1); }

        .ace-scene__explore:hover { color:#2b7cf6; background:rgba(255,255,255,.18); backdrop-filter:blur(16px) saturate(160%); border-color:rgba(255,255,255,.55); box-shadow:0 8px 30px rgba(53,88,174,.1),inset 0 1px 0 rgba(255,255,255,.45); transform:translateY(-2px); }

        .ace-scene__explore:hover svg { transform:translateX(5px); }

        /* SECOND SECTION: SUBTLY STYLED, FRAMELESS AUTOPLAY VIDEO */
        .ace-cinema { position:relative; isolation:isolate; padding:96px 24px 104px; background:radial-gradient(ellipse at 15% 45%,rgba(247,216,239,.40),transparent 42%),radial-gradient(ellipse at 85% 20%,rgba(194,216,255,.35),transparent 45%),linear-gradient(180deg,rgba(255,255,255,.35),rgba(252,246,255,.63)); }
        .ace-cinema__inner { width:min(100%,1200px); margin:0 auto; }
        .ace-cinema__heading { text-align:center; margin-bottom:28px; }
        .ace-cinema__heading p { margin:12px 0 0; color:#706a8d; font-size:15px; line-height:1.6; }
        .ace-cinema__theater { position:relative; width:100%; max-width:1160px; margin:0 auto; padding:0; border:0; background:transparent; }
        .ace-cinema__theater::before { position:absolute; z-index:-1; content:""; top:40px; right:4%; bottom:10px; left:4%; border-radius:50%; background:linear-gradient(100deg,rgba(249,195,215,.28),rgba(169,189,245,.32),rgba(199,169,212,.25)); filter:blur(42px); pointer-events:none; }
        .ace-cinema__topline { display:flex; align-items:center; gap:9px; min-height:30px; margin:0 2px 12px; color:#766a9d; font-size:10px; font-weight:800; letter-spacing:.12em; }
        .ace-cinema__topline-mark { width:7px; height:7px; flex:none; border-radius:50%; background:#b64074; box-shadow:0 0 0 4px rgba(182,64,116,.10); }
        .ace-cinema__topline-trail { display:block; width:100%; margin:0 auto; text-align:center; color:#938ba8; font-size:9px; font-weight:750; }
        /* Thin rounded edges and glow; no physical frame, bezel or casing. */
        .ace-cinema__screen { position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; border-radius:12px; background:#0d1022; outline:1px solid rgba(76,57,121,.09); box-shadow:0 24px 52px rgba(54,45,105,.14),0 6px 18px rgba(54,45,105,.07); }
        .ace-cinema__video { display:block; width:100%; height:100%; object-fit:contain; background:#0d1022; }
        .ace-cinema__play-overlay { position:absolute; z-index:2; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:22px; border:0; background:radial-gradient(circle at 50% 48%,rgba(164,140,215,.32),transparent 42%),linear-gradient(125deg,rgba(26,27,62,.83),rgba(42,35,89,.88)); color:#fff; text-align:center; cursor:pointer; transition:background .3s; }
        .ace-cinema__play-overlay:hover { background:radial-gradient(circle at 50% 48%,rgba(200,154,230,.44),transparent 48%),linear-gradient(125deg,rgba(26,27,62,.78),rgba(42,35,89,.83)); }
        .ace-cinema__play-aura { position:absolute; width:205px; height:205px; border:1px solid rgba(255,255,255,.16); border-radius:50%; box-shadow:0 0 0 24px rgba(255,255,255,.035),0 0 0 51px rgba(255,255,255,.02); pointer-events:none; }
        .ace-cinema__play-icon { z-index:1; display:grid; place-items:center; width:76px; height:76px; padding-left:4px; border:1px solid rgba(255,255,255,.6); border-radius:50%; background:linear-gradient(135deg,#f9c3d7,#c7a9d4 55%,#a7c7f8); color:#292453; box-shadow:0 12px 35px rgba(0,0,0,.24); transition:transform .35s cubic-bezier(.22,1,.36,1),box-shadow .35s; }
        .ace-cinema__play-icon svg { width:27px; height:27px; }
        .ace-cinema__play-overlay:hover .ace-cinema__play-icon { transform:scale(1.12); box-shadow:0 18px 40px rgba(0,0,0,.32); }
        .ace-cinema__play-title { z-index:1; margin-top:13px; font-size:clamp(17px,3vw,30px); font-weight:800; }
        .ace-cinema__play-subtitle { z-index:1; color:#e3dff1; font-size:clamp(11px,1.5vw,14px); }
        .ace-cinema__error { position:absolute; z-index:3; inset:auto 20px 30px; padding:16px; border-radius:12px; color:#fff; background:rgba(75,32,77,.93); text-align:center; font-size:13px; }
        .ace-cinema__underbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:17px 4px 0; }
        .ace-cinema__underbar-info { display:flex; align-items:center; gap:12px; min-width:0; }
        .ace-cinema__underbar-info > span:last-child { display:flex; flex-direction:column; gap:3px; }
        .ace-cinema__underbar-info strong { color:#38305f; font-size:13px; font-weight:800; }
        .ace-cinema__underbar-info small { color:#87809b; font-size:11px; }
        .ace-cinema__status-dot { width:9px; height:9px; flex-shrink:0; border-radius:50%; background:#b0a2cf; }
        .ace-cinema__status-dot--playing { background:#62b998; box-shadow:0 0 0 4px rgba(98,185,152,.14); }
        .ace-cinema__sound-toggle { display:inline-flex; align-items:center; justify-content:center; gap:9px; flex-shrink:0; padding:10px 15px; border:1px solid rgba(153,137,195,.23); border-radius:50px; background:rgba(255,255,255,.65); color:#554b88; font:inherit; font-size:12px; font-weight:750; cursor:pointer; backdrop-filter:blur(14px); transition:transform .25s,background .25s,border-color .25s,box-shadow .25s; }
        .ace-cinema__sound-toggle:hover { transform:translateY(-2px); background:rgba(255,255,255,.9); border-color:rgba(153,137,195,.42); box-shadow:0 8px 20px rgba(83,64,151,.10); }
        .ace-cinema__sound-toggle i { font-size:13px; }
        .ace-cinema__steps { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; margin-top:33px; }
        .ace-cinema__step { padding:25px 25px 27px; border:1px solid rgba(255,255,255,.92); border-radius:22px; background:rgba(255,255,255,.62); box-shadow:0 12px 34px rgba(102,88,163,.08); backdrop-filter:blur(16px); transition:transform .28s,box-shadow .28s; }
        .ace-cinema__step:hover { transform:translateY(-5px); box-shadow:0 20px 38px rgba(102,88,163,.14); }
        .ace-cinema__step-header { display:flex; align-items:center; justify-content:space-between; }
        .ace-cinema__step-number { font-size:13px; font-weight:900; color:#9b84bd; }
        .ace-cinema__step-icon { display:grid; place-items:center; width:42px; height:42px; border-radius:14px; background:linear-gradient(135deg,#f9e6f1,#e4e7ff); color:#604d9f; font-size:18px; }
        .ace-cinema__step h3 { margin:17px 0 7px; font-size:19px; font-weight:800; }
        .ace-cinema__step p { margin:0; color:#77728f; font-size:13px; line-height:1.7; }

        /* REMAINING LANDING SECTIONS */

        .ace-home__destination { padding:98px 24px; background:linear-gradient(150deg,rgba(234,240,255,.68),rgba(255,236,245,.55)); }

        .ace-home__destination-inner { display:grid; grid-template-columns:1fr 1fr; align-items:center; gap:46px; width:min(100%,1040px); margin:auto; }

        .ace-home__destination-copy { max-width:490px; }

        .ace-home__text-link { display:inline-flex; align-items:center; gap:13px; margin-top:16px; padding:10px 0; font-size:14px; font-weight:800; color:#3558ae; text-decoration:none; }

        .ace-home__text-link svg { width:18px; height:18px; transition:transform .25s; }

        .ace-home__text-link:hover svg { transform:translateX(5px); }

        .ace-home__destination-art { position:relative; display:grid; place-items:center; min-height:380px; }

        .ace-home__destination-disc { position:relative; width:min(100%,370px); aspect-ratio:1; overflow:hidden; border:11px solid rgba(255,255,255,.8); border-radius:50%; background:linear-gradient(180deg,#d5e9ff,#efe3ff 52%,#ffe1dd); box-shadow:0 26px 65px rgba(87,74,141,.16); }

        .ace-home__destination-sun { position:absolute; top:20%; right:22%; width:84px; height:84px; border-radius:50%; background:#ffe49c; box-shadow:0 0 40px #ffe4a0; }

        .ace-home__destination-mountain { position:absolute; bottom:-20%; width:120%; height:65%; border-radius:50% 50% 0 0; }

        .ace-home__destination-mountain--back { left:-30%; background:#b9c4e9; transform:rotate(-10deg); }

        .ace-home__destination-mountain--front { right:-35%; bottom:-26%; background:#8daec9; transform:rotate(12deg); }

        .ace-home__destination-gate { position:absolute; left:50%; bottom:12%; width:146px; height:164px; transform:translateX(-50%); }

        .ace-home__destination-gate i { position:absolute; top:36px; bottom:0; width:16px; background:#cf5978; box-shadow:inset -4px 0 rgba(95,42,88,.18); }

        .ace-home__destination-gate i:nth-child(1) { left:22px; }.ace-home__destination-gate i:nth-child(2) { right:22px; }

        .ace-home__destination-gate b,.ace-home__destination-gate em { position:absolute; left:7px; width:132px; height:15px; border-radius:7px 7px 2px 2px; background:#cf5978; transform:rotate(-1deg); }

        .ace-home__destination-gate b { top:24px; }.ace-home__destination-gate em { top:49px; }

        .ace-home__destination-tag { position:absolute; right:3%; bottom:10px; padding:11px 18px; border:1px solid #fff; border-radius:100px; background:rgba(255,255,255,.87); box-shadow:0 8px 30px rgba(72,60,132,.12); font-size:11px; font-weight:900; letter-spacing:.08em; }

        .ace-home__destination-tag span { color:#bb6a9f; }





        /* ABOUT ACE — COMPACT EDITORIAL SPLIT + SKY-BLUE COMIC BUBBLE */
        .ace-about { position:relative; isolation:isolate; padding:100px 24px 98px; background:radial-gradient(ellipse at 10% 25%,rgba(249,195,215,.19),transparent 44%),radial-gradient(ellipse at 89% 80%,rgba(172,204,255,.23),transparent 45%),linear-gradient(180deg,rgba(255,255,255,.5),rgba(249,247,255,.68)); }
        .ace-about__inner { width:min(100%,1180px); margin:0 auto; }
        .ace-about__main { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.05fr); gap:clamp(32px,5vw,68px); align-items:center; }
        .ace-about__intro { min-width:0; }
        .ace-about__eyebrow { display:inline-flex; align-items:center; gap:12px; margin-bottom:24px; color:#7962a1; font-size:10px; font-weight:850; letter-spacing:.18em; }
        .ace-about__eyebrow-line { width:24px; height:3px; border-radius:4px; background:#3558ae; }
        .ace-about__heading { max-width:590px; margin:0; color:#292452; font-size:clamp(39px,4.2vw,61px); font-weight:850; line-height:1.09; letter-spacing:-.053em; }
        .ace-about__ace { color:#b64074; white-space:nowrap; }
        .ace-about__heading em { color:#3558ae; font-style:normal; }
        .ace-about__description { max-width:490px; margin:25px 0 0; color:#746d91; font-size:15px; line-height:1.85; }
        .ace-about__promise { margin:25px 0 0; padding-left:16px; border-left:3px solid #aacceb; color:#82759d; font-size:10px; font-weight:850; letter-spacing:.15em; line-height:1.9; }
        .ace-about__actions { display:flex; align-items:center; flex-wrap:wrap; gap:16px; margin-top:30px; }
        .ace-about__primary,.ace-about__secondary { display:inline-flex; align-items:center; justify-content:center; gap:10px; min-height:49px; border-radius:100px; font-size:12px; font-weight:800; text-decoration:none; transition:transform .27s cubic-bezier(.22,1,.36,1),box-shadow .27s,color .27s; }
        .ace-about__primary { padding:13px 22px; background:linear-gradient(105deg,#b64074,#8c68af 50%,#3558ae); color:#fff; box-shadow:0 12px 27px rgba(95,70,165,.19); }
        .ace-about__secondary { padding:13px 5px; color:#3558ae; }
        .ace-about__actions svg { width:17px; height:17px; transition:transform .25s; }
        .ace-about__primary:hover { transform:translateY(-3px); box-shadow:0 16px 34px rgba(95,70,165,.27); }
        .ace-about__secondary:hover { color:#b64074; }
        .ace-about__actions a:hover svg { transform:translate(3px,-2px); }
        .ace-about__visual { position:relative; min-width:0; }
        .ace-about__stage { position:relative; isolation:isolate; min-height:510px; border:1px solid rgba(255,255,255,.96); border-radius:36px; overflow:hidden; background:radial-gradient(circle at 32% 28%,#fff 0%,transparent 42%),radial-gradient(circle at 83% 84%,rgba(154,206,255,.45),transparent 50%),linear-gradient(135deg,#fff1f8 0%,#f2eafd 48%,#e5f0ff 100%); box-shadow:0 28px 65px rgba(91,75,149,.11),inset 0 1px 0 #fff; }
        .ace-about__stage::before { position:absolute; inset:20px; content:""; border:1px solid rgba(102,103,173,.12); border-radius:24px; pointer-events:none; }
        .ace-about__ring { position:absolute; z-index:-1; top:48%; left:50%; width:360px; height:360px; border:1px solid rgba(120,137,205,.16); border-radius:50%; transform:translate(-50%,-50%); pointer-events:none; }
        .ace-about__ring--outer { width:445px; height:445px; border-style:dashed; opacity:.7; }
        .ace-about__portrait-disc { position:absolute; left:50%; top:51%; display:grid; place-items:center; width:min(77%,370px); aspect-ratio:1; border:1px solid rgba(255,255,255,.92); border-radius:50%; transform:translate(-50%,-50%); background:radial-gradient(circle at 33% 21%,#fff 4%,#fcecf7 36%,#dce9ff 100%); box-shadow:0 21px 65px rgba(101,80,162,.14),inset 0 0 0 12px rgba(255,255,255,.2); }
        .ace-about__portrait { position:relative; z-index:1; display:block; width:95%; height:auto; object-fit:contain; filter:drop-shadow(0 12px 15px rgba(89,75,151,.16)); animation:ace-about-float 6s ease-in-out infinite; }
        .ace-about__speech { position:absolute; z-index:4; top:23px; right:20px; display:flex; flex-direction:column; align-items:flex-start; gap:7px; width:min(58%,255px); min-height:115px; padding:17px 18px 16px; border:2px solid #28305e; border-radius:20px 20px 20px 7px; background:#bceaff; box-shadow:6px 7px 0 #28305e; transform:rotate(2deg); }
        .ace-about__speech::before { position:absolute; bottom:-16px; left:26px; width:0; height:0; border-top:17px solid #28305e; border-right:17px solid transparent; content:""; }
        .ace-about__speech::after { position:absolute; bottom:-10px; left:28px; width:0; height:0; border-top:12px solid #bceaff; border-right:12px solid transparent; content:""; }
        .ace-about__speech-language { color:#365b86; font-size:9px; font-weight:900; letter-spacing:.11em; }
        .ace-about__speech strong { color:#252454; font-size:18px; line-height:1.18; font-weight:900; }
        .ace-about__speech-subtitle { color:#476183; font-size:11px; font-weight:550; line-height:1.42; }
        .ace-about__nametag { position:absolute; z-index:3; bottom:26px; left:23px; display:flex; align-items:center; gap:11px; padding:10px 16px 10px 10px; border:1px solid rgba(255,255,255,.94); border-radius:17px; background:rgba(255,255,255,.88); box-shadow:0 10px 26px rgba(91,72,156,.11); backdrop-filter:blur(12px); }
        .ace-about__nametag-letter { display:grid; place-items:center; width:37px; height:37px; border-radius:11px; background:#e6efff; color:#3558ae; font-size:19px; font-weight:900; }
        .ace-about__nametag > span:last-child { display:flex; flex-direction:column; gap:3px; }
        .ace-about__nametag strong { color:#292452; font-size:15px; font-weight:900; }
        .ace-about__nametag small { color:#847d9b; font-size:9px; font-weight:850; letter-spacing:.1em; }
        .ace-about__greet { display:flex; align-items:center; justify-content:center; gap:12px; width:max-content; max-width:100%; min-height:44px; margin:19px auto 0; padding:7px 16px 7px 8px; border:1px solid rgba(151,156,215,.34); border-radius:100px; background:rgba(255,255,255,.8); box-shadow:0 8px 24px rgba(101,80,162,.08); color:#403e7d; font:inherit; font-size:12px; font-weight:850; cursor:pointer; transition:transform .25s,background .25s,box-shadow .25s; }
        .ace-about__greet:hover { transform:translateY(-3px); background:#fff; box-shadow:0 14px 30px rgba(101,80,162,.14); }
        .ace-about__greet-icon { display:grid; place-items:center; width:29px; height:29px; border-radius:50%; background:#daefff; color:#3558ae; }
        .ace-about__greet > svg { width:16px; height:16px; transition:transform .25s; }
        .ace-about__greet:hover > svg { transform:translateX(4px); }
        @keyframes ace-about-float { 0%,100% {transform:translateY(0);} 50% {transform:translateY(-9px);} }

        /* LANGUAGE COUNT + FLAG-BASED EXPLORER — REPLACES PREVIOUS THREE CARDS */
        .ace-langline { position:relative; padding:100px 24px 105px; background:linear-gradient(180deg,rgba(249,247,255,.68),rgba(250,248,255,.87)); }
        .ace-langline__inner { display:grid; grid-template-columns:minmax(0,.83fr) minmax(0,1.17fr); gap:50px; align-items:center; width:min(100%,1180px); min-height:293px; margin:0 auto; padding:40px 48px; border:1px solid rgba(255,255,255,.15); border-radius:34px; background:radial-gradient(ellipse at 100% 0%,rgba(128,150,243,.26),transparent 46%),linear-gradient(125deg,#282357 0%,#393474 57%,#303a85 100%); box-shadow:0 24px 48px rgba(55,48,122,.14); }
        .ace-langline__eyebrow { display:block; margin-bottom:18px; color:#c4b1ea; font-size:10px; font-weight:850; letter-spacing:.19em; }
        .ace-langline__count-group { display:flex; align-items:center; gap:22px; }
        .ace-langline__count { color:#f9c3d7; font-size:clamp(85px,9vw,132px); font-weight:850; line-height:.9; letter-spacing:-.08em; font-variant-numeric:tabular-nums; }
        .ace-langline__count-group h2 { max-width:220px; margin:0; color:#fff; font-size:clamp(21px,2.4vw,31px); font-weight:850; line-height:1.13; letter-spacing:-.035em; }
        .ace-langline__count-group p { margin:11px 0 0; color:#cecae8; font-size:12px; line-height:1.6; }
        .ace-langline__link { display:inline-flex; align-items:center; gap:10px; margin-top:25px; color:#cceaff; font-size:12px; font-weight:800; text-decoration:none; }
        .ace-langline__link svg { width:16px; height:16px; transition:transform .22s; }
        .ace-langline__link:hover svg { transform:translate(3px,-3px); }
        .ace-langline__list { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:11px; }
        .ace-langline__item { cursor: default; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:9px; min-height:105px; padding:12px 6px; border:1px solid rgba(255,255,255,.19); border-radius:17px; background:rgba(255,255,255,.075); color:#f5f4ff; font-size:11px; font-weight:800; text-align:center; text-decoration:none; transition:background .27s,transform .27s,border-color .27s; }
        .ace-langline__item:hover { transform:translateY(-5px); border-color:rgba(255,255,255,.5); background:rgba(255,255,255,.16); }
        .ace-langline__flag { width:32px; height:32px; border-radius:7px; object-fit:contain; }

        /* 3 LEARNER BENEFITS — EDITORIAL COLUMNS, NO REPEATED CARDS */
        .ace-benefits { padding:92px 24px 109px; background:linear-gradient(180deg,rgba(250,248,255,.87),rgba(255,255,255,.65)); }
        .ace-benefits__inner { width:min(100%,1180px); margin:auto; }
        .ace-benefits__heading { max-width:750px; margin:0 auto 53px; text-align:center; }
        .ace-benefits__eyebrow { color:#8a73b2; font-size:10px; font-weight:850; letter-spacing:.17em; }
        .ace-benefits__heading h2 { margin:15px 0 14px; color:#292452; font-size:clamp(34px,4vw,54px); font-weight:850; line-height:1.12; letter-spacing:-.045em; }
        .ace-benefits__heading h2 span { color:#3558ae; }
        .ace-benefits__heading p { margin:0; color:#78718f; font-size:14px; line-height:1.75; }
        .ace-benefits__list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border-top:1px solid rgba(108,99,151,.19); border-bottom:1px solid rgba(108,99,151,.19); }
        .ace-benefits__item { position:relative; min-width:0; padding:35px 36px 42px; transition:background .25s ease; }
        .ace-benefits__item:not(:last-child) { border-right:1px solid rgba(108,99,151,.19); }
        .ace-benefits__item:hover { background:rgba(229,236,255,.28); }
        .ace-benefits__item:first-child { padding-left:0; }
        .ace-benefits__item:last-child { padding-right:0; }
        .ace-benefits__meta { display:flex; align-items:center; gap:16px; margin-bottom:27px; }
        .ace-benefits__number { color:#3558ae; font-size:34px; font-weight:850; letter-spacing:-.04em; line-height:1; }
        .ace-benefits__kicker { color:#968bae; font-size:9px; font-weight:900; letter-spacing:.16em; }
        .ace-benefits__item h3 { max-width:290px; margin:0 0 12px; color:#2a255c; font-size:clamp(19px,2vw,26px); font-weight:850; letter-spacing:-.035em; line-height:1.23; }
        .ace-benefits__item p { max-width:310px; margin:0; color:#756e90; font-size:13px; line-height:1.8; }

        /* BOLD FOOTER */
        .ace-footer { position:relative; isolation:isolate; overflow:hidden; padding:0 24px 22px; background:radial-gradient(circle at 86% 85%,rgba(81,100,192,.22),transparent 37%),linear-gradient(120deg,#25214f 0%,#252453 55%,#20294f 100%); color:#fff; }
        .ace-footer::before { content:""; position:absolute; top:0; left:0; right:0; height:4px; background:linear-gradient(90deg,#f7c865,#f9c3d7 35%,#c7a9d4 63%,#91c8ef); }
        .ace-footer__top,.ace-footer__main,.ace-footer__bottom { width:min(100%,1180px); margin:auto; }
        .ace-footer__top { display:flex; justify-content:space-between; align-items:flex-end; gap:35px; padding:76px 0 65px; border-bottom:1px solid rgba(255,255,255,.17); }
        .ace-footer__eyebrow { color:#c7aadf; font-size:10px; font-weight:850; letter-spacing:.19em; }
        .ace-footer__cta h2 { max-width:730px; margin:17px 0 14px; color:#fff; font-size:clamp(35px,5.1vw,66px); font-weight:850; line-height:1.07; letter-spacing:-.055em; }
        .ace-footer__cta h2 em { color:#f9c3d7; font-style:normal; }
        .ace-footer__cta p { margin:0; color:#bfc2e2; font-size:14px; line-height:1.7; }
        .ace-footer__cta-button { display:inline-flex; flex-shrink:0; align-items:center; gap:15px; padding:16px 21px; border-radius:100px; background:linear-gradient(100deg,#f5a8ce,#c7a9e4 55%,#91bdf6); box-shadow:0 12px 35px rgba(11,11,40,.24); color:#292452; font-size:12px; font-weight:900; text-decoration:none; transition:transform .25s,box-shadow .25s; }
        .ace-footer__cta-button svg { width:18px; height:18px; }
        .ace-footer__cta-button:hover { transform:translateY(-4px); box-shadow:0 19px 40px rgba(11,11,40,.32); }
        .ace-footer__main { display:grid; grid-template-columns:1fr 1fr; gap:70px; padding:61px 0 65px; }
        .ace-footer__wordmark { display:inline-flex; align-items:baseline; color:#fff; font-size:clamp(39px,4.1vw,57px); font-weight:700; line-height:1; letter-spacing:-.068em; text-decoration:none; font-family: "Fredoka", sans-serif;} 
        .ace-footer__letter--a { color:#f5d38e; }
        .ace-footer__letter--c { color:#f3abce; }
        .ace-footer__letter--e { color:#9bd3fd; }
        .ace-footer__identity p { margin:13px 0 24px; color:#e0d9f8; font-size:15px; font-weight:700; }
        .ace-footer__identity-note { color:#9698c7; font-size:9px; font-weight:850; letter-spacing:.17em; }
        .ace-footer__nav { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:22px; }
        .ace-footer__nav-group { display:flex; flex-direction:column; align-items:flex-start; gap:14px; }
        .ace-footer__nav-group h3 { margin:0 0 9px; color:#b6a9da; font-size:10px; font-weight:850; letter-spacing:.14em; }
        .ace-footer__nav-group a { color:#e0dcf2; font-size:12px; font-weight:650; text-decoration:none; transition:color .22s,transform .22s; }
        .ace-footer__nav-group a:hover { color:#a9dbff; transform:translateX(3px); }
        .ace-footer__bottom { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; padding-top:22px; border-top:1px solid rgba(255,255,255,.17); color:#a5a5cf; font-size:10px; font-weight:700; letter-spacing:.03em; }
        .ace-footer__bottom > span:nth-child(2) { letter-spacing:.13em; font-weight:850; font-size:9px; }
        .ace-footer__totop { display:inline-flex; gap:8px; align-items:center; color:#d7cff2; text-decoration:none; font-weight:800; }
        .ace-footer__totop svg { width:15px; height:15px; transform:rotate(-90deg); }
        .ace-footer__totop:hover { color:#a9dbff; }

        @media (max-width:1050px) {
          .ace-about__main { gap:26px; }
          .ace-about__heading { font-size:clamp(35px,4.2vw,52px); }
          .ace-about__stage { min-height:465px; }
          .ace-langline__inner { gap:28px; padding:37px 34px; }
          .ace-langline__list { grid-template-columns:repeat(4,minmax(0,1fr)); }
        }
        @media (max-width:820px) {
          .ace-about { padding:82px 20px 77px; }
          .ace-about__main { grid-template-columns:1fr; gap:35px; }
          .ace-about__intro { max-width:660px; margin:auto; text-align:center; }
          .ace-about__heading { max-width:650px; font-size:clamp(37px,6vw,53px); }
          .ace-about__description { max-width:585px; margin:21px auto 0; }
          .ace-about__promise { display:inline-block; }
          .ace-about__actions { justify-content:center; }
          .ace-about__visual { width:min(100%,570px); margin:auto; }
          .ace-about__stage { min-height:485px; }
          .ace-langline__inner { grid-template-columns:1fr; gap:28px; }
          .ace-langline__count-group h2 { max-width:none; }
          .ace-langline__list { grid-template-columns:repeat(4,minmax(0,1fr)); }
          .ace-benefits__item { padding:30px 22px 34px; }
          .ace-benefits__item h3 { font-size:21px; }
          .ace-footer__main { grid-template-columns:1fr; gap:35px; }
        }
        @media (max-width:620px) {
          .ace-about { padding:72px 15px 66px; }
          .ace-about__eyebrow { margin-bottom:20px; font-size:9px; }
          .ace-about__heading { font-size:clamp(34px,8.5vw,44px); }
          .ace-about__description { font-size:13px; line-height:1.85; }
          .ace-about__promise { font-size:9px; line-height:1.5; }
          .ace-about__actions { gap:11px; margin-top:24px; }
          .ace-about__primary,.ace-about__secondary { font-size:11px; }
          .ace-about__stage { min-height:390px; border-radius:25px; }
          .ace-about__stage::before { inset:14px; border-radius:17px; }
          .ace-about__ring { width:285px; height:285px; }
          .ace-about__ring--outer { width:360px; height:360px; }
          .ace-about__portrait-disc { width:min(74%,275px); top:53%; }
          .ace-about__speech { top:11px; right:13px; width:min(64%,216px); min-height:97px; gap:5px; padding:12px; border-radius:16px 16px 16px 6px; box-shadow:4px 5px 0 #28305e; }
          .ace-about__speech-language { font-size:8px; }
          .ace-about__speech strong { font-size:14px; }
          .ace-about__speech-subtitle { font-size:10px; }
          .ace-about__nametag { bottom:14px; left:13px; padding:8px; }
          .ace-about__nametag-letter { width:30px; height:30px; font-size:16px; }
          .ace-about__nametag strong { font-size:12px; }
          .ace-about__nametag small { font-size:7px; }
          .ace-langline { padding:0 15px 72px; }
          .ace-langline__inner { gap:25px; padding:27px 22px; border-radius:24px; }
          .ace-langline__count-group { gap:18px; }
          .ace-langline__count { font-size:83px; }
          .ace-langline__count-group h2 { font-size:25px; }
          .ace-langline__list { grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
          .ace-langline__item { flex-direction:row; justify-content:flex-start; gap:12px; min-height:58px; padding:10px 12px; text-align:left; }
          .ace-langline__flag { width:29px; height:29px; }
          .ace-benefits { padding:73px 20px 85px; }
          .ace-benefits__heading { margin-bottom:35px; }
          .ace-benefits__heading p { font-size:13px; }
          .ace-benefits__list { grid-template-columns:1fr; }
          .ace-benefits__item { padding:27px 0 30px; }
          .ace-benefits__item:not(:last-child) { border-right:0; border-bottom:1px solid rgba(108,99,151,.19); }
          .ace-benefits__item h3 { font-size:22px; }
          .ace-benefits__meta { margin-bottom:18px; }
          .ace-footer { padding:0 20px 25px; }
          .ace-footer__top { flex-direction:column; align-items:flex-start; gap:24px; padding:65px 0 46px; }
          .ace-footer__cta h2 { font-size:clamp(35px,9.2vw,49px); }
          .ace-footer__main { padding:46px 0; }
          .ace-footer__nav { grid-template-columns:repeat(2,minmax(0,1fr)); row-gap:36px; }
          .ace-footer__bottom { gap:14px; }
          .ace-footer__bottom > span:nth-child(2) { display:none; }
        }

        .ace-home__button { display:inline-flex; align-items:center; justify-content:center; gap:10px; white-space:nowrap; padding:15px 22px; border-radius:100px; text-decoration:none; font-size:13px; font-weight:800; transition:transform .25s,box-shadow .25s; }

        .ace-home__button--primary { background:linear-gradient(110deg,#b64074,#7e75c3,#3558ae); color:#fff; box-shadow:0 10px 30px rgba(94,76,161,.2); }

        .ace-home__button:hover { transform:translateY(-3px); box-shadow:0 15px 35px rgba(94,76,161,.25); }

        .ace-home__button svg { width:17px; height:17px; }

        /* FLOATING SCROLL-TO-TOP ARROW */

        .ace-backtop { position:fixed; z-index:95; right:clamp(16px,3vw,44px); bottom:clamp(20px,5vh,44px); display:flex; align-items:center; gap:11px; padding:7px 16px 7px 7px; border:1px solid rgba(255,255,255,.85); border-radius:100px; background:rgba(255,255,255,.75); box-shadow:0 14px 44px rgba(71,62,139,.18),inset 0 1px 0 #fff; backdrop-filter:blur(18px) saturate(160%); color:#332b70; font:inherit; font-size:12px; font-weight:800; cursor:pointer; opacity:0; visibility:hidden; pointer-events:none; transform:translateY(15px) scale(.94); transition:opacity .3s,visibility .3s,transform .35s cubic-bezier(.22,1,.36,1),box-shadow .3s; }

        .ace-backtop--visible { opacity:1; visibility:visible; pointer-events:auto; transform:translateY(0) scale(1); }

        .ace-backtop:hover { transform:translateY(-4px) scale(1.025); box-shadow:0 20px 45px rgba(71,62,139,.24); }

        .ace-backtop__icon { display:grid; place-items:center; width:38px; height:38px; border-radius:50%; background:linear-gradient(140deg,#c7a9d4,#9ebbe9); color:#fff; }

        .ace-backtop__icon svg { width:19px; height:19px; transition:transform .3s; }

        .ace-backtop:hover .ace-backtop__icon svg { transform:translateY(-3px); }

        .ace-backtop__label { white-space:nowrap; }

        .ace-home a:focus-visible,.ace-home button:focus-visible { outline:3px solid #3558ae; outline-offset:5px; }

        /* RESPONSIVENESS */

        @media (max-width:900px) {

          .ace-scene__bubble { width:148px; min-height:49px; padding:7px 8px; gap:7px; }

          .ace-scene__flag { width:28px; height:28px; }

          .ace-scene__bubble-text strong { font-size:10px; }.ace-scene__bubble-text small { font-size:8px; }

          .ace-scene__bubble:nth-child(1),.ace-scene__bubble:nth-child(5) { left:2%; }

          .ace-scene__bubble:nth-child(2),.ace-scene__bubble:nth-child(6),.ace-scene__bubble:nth-child(8) { right:1%; }

          .ace-home__destination-inner { gap:25px; }

        }

        @media (max-width:680px) {

          .ace-scene { padding:10px 12px 16px; }

          .ace-scene__stage { height:520px; }

          .ace-scene__center { top:137px; width:250px; }

          .ace-scene__card { min-height:260px; padding:16px 13px; border-radius:25px; }

          .ace-scene__portrait { width:180px; }.ace-scene__portrait-halo { width:150px; height:150px; }

          .ace-scene__title { font-size:23px; }.ace-scene__glow { width:330px; }.ace-scene__orbit--outer { width:340px;height:340px; }.ace-scene__orbit--inner { width:270px;height:270px; }

          .ace-scene__bubble:nth-child(n+5) { display:none; }

          .ace-scene__bubble { width:min(37vw,137px); min-height:47px; padding:6px; gap:6px; border-radius:11px; box-shadow:2px 3px 0 #2a255c; }

          .ace-scene__bubble:nth-child(1) { top:12px;left:1%; }

          .ace-scene__bubble:nth-child(2) { top:77px;right:1%; }

          .ace-scene__bubble:nth-child(3) { top:422px;left:1%; }

          .ace-scene__bubble:nth-child(4) { top:464px;right:1%; }

          .ace-scene__flag { width:25px;height:25px;border-radius:7px; }.ace-scene__bubble-text strong { font-size:9px; }

          .ace-cinema { padding:72px 12px 76px; }
          .ace-cinema__heading { margin-bottom:22px; }
          .ace-cinema__heading p { font-size:13px; }
          .ace-cinema__topline { font-size:9px; margin-bottom:9px; }
          .ace-cinema__topline-trail { display:block; font-size:8px; }
          .ace-cinema__screen { border-radius:8px; box-shadow:0 14px 32px rgba(54,45,105,.12); }
          .ace-cinema__underbar { gap:10px; padding-top:14px; }
          .ace-cinema__underbar-info strong { font-size:11px; }
          .ace-cinema__underbar-info small { font-size:10px; }
          .ace-cinema__sound-toggle { gap:7px; padding:9px 12px; font-size:11px; }
          .ace-cinema__play-icon { width:53px; height:53px; }
          .ace-cinema__play-icon svg { width:20px; height:20px; }
          .ace-cinema__play-title { margin-top:5px; }
          .ace-cinema__play-subtitle { max-width:210px; line-height:1.4; }
          .ace-cinema__play-aura { width:130px; height:130px; }
          .ace-cinema__steps { grid-template-columns:1fr; gap:12px; margin-top:20px; }
          .ace-cinema__step { padding:19px 20px; }
          .ace-home__destination { padding:65px 20px; }.ace-home__destination-inner { grid-template-columns:1fr;gap:10px; }

          .ace-home__destination-art { min-height:330px; }.ace-home__destination-disc { width:290px; }

          .ace-backtop { bottom:20px;right:15px;gap:8px;padding:6px 11px 6px 6px; }.ace-backtop__icon { width:33px;height:33px; }.ace-backtop__label { font-size:11px; }

        }

        @media (max-width:390px) {

          .ace-scene__center { width:220px; }.ace-scene__portrait { width:155px; }.ace-scene__card { min-height:246px; }

          .ace-scene__bubble { width:125px; }.ace-scene__bubble-text strong { font-size:8px; }



        }

        @media (max-height:700px) and (max-width:680px) {

          .ace-scene__stage { height:460px; }.ace-scene__center { top:115px; }.ace-scene__card { min-height:235px;padding:12px; }

          .ace-scene__portrait { width:155px; }.ace-scene__bubble:nth-child(1) { top:5px; }.ace-scene__bubble:nth-child(2) { top:63px; }

          .ace-scene__bubble:nth-child(3) { top:365px; }.ace-scene__bubble:nth-child(4) { top:405px; }

        }

        @media (hover:none) { .ace-scene__card { transform:none !important; }.ace-scene__card-glare { opacity:0 !important; } }

        /* ============================================================
           SMOOTH ENTRANCE ANIMATIONS
           1. First fold: staged fade + rise + soft scale + blur
           2. Remaining sections: one-time scroll reveal
           Individual translate/scale properties preserve existing
           rotations, centered positioning, and interactive 3D tilt.
           ============================================================ */

        @keyframes ace-enter-rise {
          0% { opacity:0; translate:0 25px; scale:.94; filter:blur(7px); }
          65% { opacity:1; filter:blur(0); }
          100% { opacity:1; translate:0 0; scale:1; filter:blur(0); }
        }

        @keyframes ace-enter-fade {
          from { opacity:0; }
          to { opacity:1; }
        }

        .ace-scene__glow { animation:ace-enter-fade 1s ease .05s both; }
        .ace-scene__orbit--outer { animation:ace-enter-fade 1.1s ease .15s both; }
        .ace-scene__orbit--inner { animation:ace-enter-fade 1.1s ease .25s both; }

        /* Animate the centered wrapper, not the tilt card itself. */
        .ace-scene__center {
          animation:ace-enter-rise .82s cubic-bezier(.22,1,.36,1) .12s both;
        }

        .ace-scene__bubble {
          animation:ace-enter-rise .68s cubic-bezier(.22,1,.36,1) both;
        }
        .ace-scene__bubble:nth-child(1) { animation-delay:.32s; }
        .ace-scene__bubble:nth-child(2) { animation-delay:.42s; }
        .ace-scene__bubble:nth-child(3) { animation-delay:.52s; }
        .ace-scene__bubble:nth-child(4) { animation-delay:.62s; }
        .ace-scene__bubble:nth-child(5) { animation-delay:.72s; }
        .ace-scene__bubble:nth-child(6) { animation-delay:.82s; }
        .ace-scene__bubble:nth-child(7) { animation-delay:.92s; }
        .ace-scene__bubble:nth-child(8) { animation-delay:1.02s; }

        .ace-scene__explore {
          animation:ace-enter-rise .72s cubic-bezier(.22,1,.36,1) 1.1s both;
        }

        /* Secondary sections only reveal when scrolled into view. */
        .ace-home .ace-scroll-reveal {
          opacity:0;
          translate:0 22px;
          scale:.985;
          filter:blur(5px);
          transition:
            opacity .7s cubic-bezier(.22,1,.36,1),
            translate .7s cubic-bezier(.22,1,.36,1),
            scale .7s cubic-bezier(.22,1,.36,1),
            filter .7s ease;
        }
        .ace-home .ace-scroll-reveal.ace-is-visible {
          opacity:1;
          translate:0 0;
          scale:1;
          filter:blur(0);
        }
        .ace-cinema__step:nth-child(2),
        .ace-benefits__item:nth-child(2),
        .ace-footer__nav-group:nth-child(2) { transition-delay:80ms; }
        .ace-cinema__step:nth-child(3),
        .ace-benefits__item:nth-child(3),
        .ace-footer__nav-group:nth-child(3) { transition-delay:160ms; }
        .ace-langline__item:nth-child(4n + 2) { transition-delay:65ms; }
        .ace-langline__item:nth-child(4n + 3) { transition-delay:130ms; }
        .ace-langline__item:nth-child(4n + 4) { transition-delay:195ms; }

        /* Do not leave content invisible for users who disable motion. */
        @media (prefers-reduced-motion:reduce) {
          .ace-home .ace-scroll-reveal {
            opacity:1 !important;
            translate:none !important;
            scale:1 !important;
            filter:none !important;
          }
        }

        @media (prefers-reduced-motion:reduce) {

          .ace-home *, .ace-home *::before, .ace-home *::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; }

          .ace-scene__card { transform:none !important; }

        }

      `}</style>

    </main>

  );

}
