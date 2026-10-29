"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const SEEN_KEY = "acelingua_welcome_seen_v1";
const LOGO_DURATION_MS = 650;
const TOTAL_DURATION_MS = 1950;

type IntroPhase = "logo" | "reveal" | "done";

export default function ACELinguaWorld() {
  const [phase, setPhase] = useState<IntroPhase>("logo");
  const decisionRef = useRef<boolean | null>(null);
  const finishRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // The ref keeps the choice stable across React Strict Mode's effect replay.
    if (decisionRef.current === null) {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const hasAnchor = window.location.hash.length > 0;
      const forcePreview = new URLSearchParams(window.location.search).get("intro") === "1";

      let seen = false;
      try {
        seen = window.sessionStorage.getItem(SEEN_KEY) === "1";
      } catch {
        // If browser storage is blocked, the animation still works.
      }

      decisionRef.current =
        !reducedMotion && !hasAnchor && (forcePreview || !seen);
    }

    if (!decisionRef.current) {
      setPhase("done");
      return;
    }

    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // No session storage is required for the animation.
    }

    const html = document.documentElement;
    const body = document.body;
    const oldHtmlOverflow = html.style.overflow;
    const oldBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.classList.add("ace-intro-preparing");

    let finished = false;
    let portalTimer: ReturnType<typeof setTimeout>;
    let finishTimer: ReturnType<typeof setTimeout>;

    const release = () => {
      clearTimeout(portalTimer);
      clearTimeout(finishTimer);
      html.classList.remove("ace-intro-preparing", "ace-intro-revealing");
      html.style.overflow = oldHtmlOverflow;
      body.style.overflow = oldBodyOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      release();
      finishRef.current = null;
      setPhase("done");
    };

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") finish();
    }

    finishRef.current = finish;
    document.addEventListener("keydown", onKeyDown);

    portalTimer = setTimeout(() => {
      html.classList.remove("ace-intro-preparing");
      html.classList.add("ace-intro-revealing");
      setPhase("reveal");
    }, LOGO_DURATION_MS);

    finishTimer = setTimeout(finish, TOTAL_DURATION_MS);

    return () => {
      finished = true;
      release();
      finishRef.current = null;
    };
  }, []);

  if (phase === "done") return null;

  return (
    <>
      <div
        className={`ace-welcome ${phase === "reveal" ? "ace-welcome--reveal" : ""}`}
        role="status"
        aria-label="Welcome to ACELINGUA"
        aria-live="polite"
      >
        <div className="ace-welcome__ambient ace-welcome__ambient--pink" aria-hidden="true" />
        <div className="ace-welcome__ambient ace-welcome__ambient--blue" aria-hidden="true" />
        <div className="ace-welcome__ambient ace-welcome__ambient--lavender" aria-hidden="true" />

        <div className="ace-welcome__center">
          <div className="ace-welcome__logo-wrap">
            <span className="ace-welcome__halo" aria-hidden="true" />
            <Image
              src="/logoace.png"
              alt="ACELINGUA"
              width={320}
              height={128}
              priority
              className="ace-welcome__logo"
            />
          </div>
          <p className="ace-welcome__tagline">Learn. Speak. Explore.</p>
          <div className="ace-welcome__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        {phase === "logo" && (
          <button
            type="button"
            className="ace-welcome__skip"
            onClick={() => finishRef.current?.()}
          >
            Skip intro <span aria-hidden="true">↗</span>
          </button>
        )}
      </div>

      <style>{`
        @property --ace-portal-hole {
          syntax: "<length>";
          inherits: false;
          initial-value: 0px;
        }

        .ace-welcome {
          --ace-portal-hole: 0px;
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: grid;
          place-items: center;
          overflow: hidden;
          isolation: isolate;
          background: linear-gradient(124deg, #f9f2ff 0%, #e6f7ff 29%, #eeeafd 61%, #fff0e9 100%);
          color: #2a255c;
          -webkit-mask-image: radial-gradient(circle at center, transparent calc(var(--ace-portal-hole) - 1px), #000 var(--ace-portal-hole));
          mask-image: radial-gradient(circle at center, transparent calc(var(--ace-portal-hole) - 1px), #000 var(--ace-portal-hole));
        }
        .ace-welcome__ambient {
          position: absolute;
          z-index: -1;
          width: min(60vw, 600px);
          aspect-ratio: 1;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .ace-welcome__ambient--pink { top: -25%; left: -16%; background: rgba(249,195,215,.65); }
        .ace-welcome__ambient--blue { right: -12%; bottom: -28%; background: rgba(152,204,255,.48); }
        .ace-welcome__ambient--lavender { top: 12%; right: 18%; background: rgba(199,169,212,.34); }
        .ace-welcome__center {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 32px;
          text-align: center;
          animation: ace-welcome-arrive 520ms cubic-bezier(.2,.8,.2,1) both;
        }
        .ace-welcome__logo-wrap { position: relative; display: grid; place-items: center; }
        .ace-welcome__halo {
          position: absolute;
          width: 210px;
          height: 210px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,.95) 10%, rgba(255,255,255,.15) 70%, transparent 75%);
          filter: blur(8px);
          animation: ace-welcome-breathe 1.2s ease-in-out infinite alternate;
        }
        .ace-welcome__logo {
          position: relative;
          display: block;
          width: min(68vw, 285px);
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 10px 16px rgba(53,88,174,.12));
        }
        .ace-welcome__tagline {
          margin: -8px 0 0;
          color: #716a91;
          font-size: clamp(12px, 2vw, 15px);
          font-weight: 750;
          letter-spacing: .11em;
        }
        .ace-welcome__dots { display: flex; gap: 8px; margin-top: 9px; }
        .ace-welcome__dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #b64074;
          animation: ace-welcome-dot 850ms ease-in-out infinite alternate;
        }
        .ace-welcome__dots span:nth-child(2) { background: #c7a9d4; animation-delay: 130ms; }
        .ace-welcome__dots span:nth-child(3) { background: #3558ae; animation-delay: 260ms; }
        .ace-welcome__skip {
          position: absolute;
          top: max(18px, env(safe-area-inset-top));
          right: max(18px, env(safe-area-inset-right));
          border: 1px solid rgba(53,88,174,.14);
          border-radius: 999px;
          padding: 10px 16px;
          background: rgba(255,255,255,.7);
          color: #3558ae;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transition: background .2s ease, transform .2s ease;
        }
        .ace-welcome__skip:hover { background: #fff; transform: translateY(-2px); }
        .ace-welcome__skip:focus-visible { outline: 3px solid #3558ae; outline-offset: 3px; }
        .ace-welcome--reveal {
          pointer-events: none;
          animation:
            ace-welcome-circle 830ms cubic-bezier(.16,.8,.24,1) forwards,
            ace-welcome-fade 630ms ease 260ms forwards;
        }
        .ace-welcome--reveal .ace-welcome__center { animation: ace-welcome-disappear 280ms ease forwards; }
        @keyframes ace-welcome-arrive {
          from { opacity: 0; transform: translateY(18px) scale(.93); filter: blur(7px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes ace-welcome-breathe { to { transform: scale(1.12); opacity: .75; } }
        @keyframes ace-welcome-dot { to { opacity: .3; transform: translateY(-5px); } }
        @keyframes ace-welcome-disappear { to { opacity: 0; transform: scale(.82); } }
        @keyframes ace-welcome-circle {
          from { --ace-portal-hole: 0px; }
          to { --ace-portal-hole: 175vmax; }
        }
        @keyframes ace-welcome-fade {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        /* Staggered reveal of the EXISTING homepage, not a replacement design. */
        html.ace-intro-preparing .ace-header,
        html.ace-intro-preparing .ace-scene__center,
        html.ace-intro-preparing .ace-scene__bubble,
        html.ace-intro-preparing .ace-scene__explore { opacity: 0 !important; }

        html.ace-intro-revealing .ace-header { animation: ace-home-enter 550ms 70ms both; }
        html.ace-intro-revealing .ace-scene__center { animation: ace-home-enter 650ms 160ms both; }
        html.ace-intro-revealing .ace-scene__bubble { animation: ace-home-enter 560ms 250ms both; }
        html.ace-intro-revealing .ace-scene__bubble:nth-child(2) { animation-delay: 295ms; }
        html.ace-intro-revealing .ace-scene__bubble:nth-child(3) { animation-delay: 340ms; }
        html.ace-intro-revealing .ace-scene__bubble:nth-child(4) { animation-delay: 385ms; }
        html.ace-intro-revealing .ace-scene__bubble:nth-child(5) { animation-delay: 430ms; }
        html.ace-intro-revealing .ace-scene__bubble:nth-child(6) { animation-delay: 475ms; }
        html.ace-intro-revealing .ace-scene__bubble:nth-child(7) { animation-delay: 520ms; }
        html.ace-intro-revealing .ace-scene__bubble:nth-child(8) { animation-delay: 565ms; }
        html.ace-intro-revealing .ace-scene__explore { animation: ace-home-enter 520ms 640ms both; }

        @keyframes ace-home-enter {
          from { opacity: 0; translate: 0 17px; filter: blur(5px); }
          to { opacity: 1; translate: 0 0; filter: blur(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ace-welcome, .ace-welcome *,
          html.ace-intro-revealing .ace-header,
          html.ace-intro-revealing .ace-scene__center,
          html.ace-intro-revealing .ace-scene__bubble,
          html.ace-intro-revealing .ace-scene__explore {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}
