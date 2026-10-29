
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type PublicHeaderProps = {
  logoSrc?: string;
  headIconSrc?: string;
  signUpHref?: string;
  loginHref?: string;
  sticky?: boolean;
  publicPaths?: readonly string[] | null;
};

type NavItem = {
  id: "languages" | "guide" | "ace";
  href: string;
  title: string;
  subtitle: string;
};

type SectionAnchor = "how-it-works" | "meet-ace";

const DEFAULT_PUBLIC_PATHS = [
  "/",
  "/about",
  "/languages",
  "/contact",
] as const;

const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "languages",
    href: "/onboarding/languages",
    title: "Language Passport",
    subtitle: "Choose your next language",
  },
  {
    id: "guide",
    href: "/#how-it-works",
    title: "How It Works",
    subtitle: "Your adventure starts here",
  },
  {
    id: "ace",
    href: "/#meet-ace",
    title: "Meet Ace",
    subtitle: "Your learning buddy",
  },
];

const ACE_MIN_EDGE_GAP = 20;
const VIDEO_HEADER_GAP = 18;

function pathMatches(pathname: string, path: string): boolean {
  const normalized = path.replace(/\/+$/, "") || "/";
  return normalized === "/"
    ? pathname === "/"
    : pathname === normalized || pathname.startsWith(`${normalized}/`);
}

function isSectionAnchor(value: string): value is SectionAnchor {
  return value === "meet-ace" || value === "how-it-works";
}

function LoginButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="ace-header__login"
      aria-label="Log in to ACELINGUA"
    >
      <span className="ace-header__login-orbs" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <span
            key={index}
            className={`ace-header__orb ace-header__orb--${index + 1}`}
          />
        ))}
      </span>

      <span className="ace-header__login-label">
        Login
        <i className="fa-solid fa-circle-right" aria-hidden="true" />
      </span>
    </Link>
  );
}

export default function PublicHeader({
  logoSrc = "/logoace.png",
  headIconSrc = "/icon%20head.png",
  signUpHref = "/register",
  loginHref = "/login",
  sticky = true,
  publicPaths = DEFAULT_PUBLIC_PATHS,
}: PublicHeaderProps) {
  const pathname = usePathname() ?? "/";
  const headerRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Always hide the shared header on the Language Passport page.
  const isOnboardingLanguages = pathMatches(
    pathname,
    "/onboarding/languages"
  );

  const isPublic =
    !isOnboardingLanguages &&
    (publicPaths === null ||
      publicPaths.some((path) => pathMatches(pathname, path)));

  useEffect(() => {
    if (!sticky || !isPublic) return;

    let frame: number | null = null;

    const update = () => {
      frame = null;
      setScrolled(window.scrollY > 24);
    };

    const onScroll = () => {
      if (frame === null) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [sticky, isPublic]);

  const scrollToAnchor = useCallback(
    (id: SectionAnchor, behavior: ScrollBehavior): boolean => {
      const section = document.getElementById(id);
      if (!section) return false;

      const headerBottom = sticky
        ? Math.max(
            0,
            headerRef.current?.getBoundingClientRect().bottom ?? 0
          )
        : 0;

      if (id === "meet-ace") {
        const content =
          section.querySelector<HTMLElement>(".ace-about__main") ??
          section.querySelector<HTMLElement>(".ace-about__inner") ??
          section;

        const rect = content.getBoundingClientRect();
        const usableHeight = Math.max(
          0,
          window.innerHeight - headerBottom
        );

        const offsetWithinUsableArea =
          rect.height + ACE_MIN_EDGE_GAP * 2 <= usableHeight
            ? (usableHeight - rect.height) / 2
            : ACE_MIN_EDGE_GAP;

        const desiredTop = headerBottom + offsetWithinUsableArea;
        const absoluteTop = window.scrollY + rect.top;

        window.scrollTo({
          top: Math.max(0, Math.round(absoluteTop - desiredTop)),
          behavior,
        });

        return true;
      }

      const absoluteTop =
        window.scrollY + section.getBoundingClientRect().top;

      window.scrollTo({
        top: Math.max(
          0,
          Math.round(
            absoluteTop - headerBottom - VIDEO_HEADER_GAP
          )
        ),
        behavior,
      });

      return true;
    },
    [sticky]
  );

  useEffect(() => {
    if (pathname !== "/" || !isPublic) return;

    let frame = 0;
    let attempts = 0;
    let cancelled = false;

    const scrollFromHash = () => {
      window.cancelAnimationFrame(frame);
      attempts = 0;

      const hash = decodeURIComponent(
        window.location.hash.slice(1)
      );

      if (!isSectionAnchor(hash)) return;

      const moveWhenReady = () => {
        if (cancelled) return;

        attempts += 1;

        if (!document.getElementById(hash) && attempts < 30) {
          frame = window.requestAnimationFrame(moveWhenReady);
          return;
        }

        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;

        scrollToAnchor(
          hash,
          reduceMotion ? "auto" : "smooth"
        );
      };

      frame = window.requestAnimationFrame(moveWhenReady);
    };

    scrollFromHash();

    window.addEventListener("hashchange", scrollFromHash);
    window.addEventListener("popstate", scrollFromHash);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", scrollFromHash);
      window.removeEventListener("popstate", scrollFromHash);
    };
  }, [pathname, isPublic, scrollToAnchor]);

  function handleNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    item: NavItem
  ) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (
      pathname !== "/" ||
      !item.href.startsWith("/#")
    ) {
      return;
    }

    const id = item.href.slice(2);

    if (
      !isSectionAnchor(id) ||
      !document.getElementById(id)
    ) {
      return;
    }

    event.preventDefault();
    window.history.pushState(null, "", item.href);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    scrollToAnchor(
      id,
      reduceMotion ? "auto" : "smooth"
    );
  }

  if (!isPublic) return null;

  return (
    <header
      ref={headerRef}
      className={`ace-header${
        sticky ? " ace-header--sticky" : ""
      }${
        sticky && scrolled ? " ace-header--scrolled" : ""
      }`}
    >
      <div className="ace-header__inner">
        {/* BRAND */}
        <Link
          href="/"
          className="ace-header__brand"
          aria-label="ACELINGUA home"
        >
          <Image
            src={logoSrc}
            alt="ACELINGUA"
            width={192}
            height={76}
            priority
            sizes="(max-width: 480px) 112px, (max-width: 760px) 130px, 175px"
            className="ace-header__logo"
          />
        </Link>

        {/* CENTER NAVIGATION */}
        <nav
          className="ace-header__nav"
          aria-label="Explore ACELINGUA"
        >
          {NAV_ITEMS.map((item) => {
            const active =
              item.id === "languages" &&
              pathMatches(
                pathname,
                "/onboarding/languages"
              );

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={(event) =>
                  handleNavigation(event, item)
                }
                className={`ace-header__nav-link ace-header__nav-link--${item.id}`}
                aria-label={`${item.title}. ${item.subtitle}`}
                aria-current={
                  active ? "page" : undefined
                }
              >
                <span
                  className="ace-header__nav-art"
                  aria-hidden="true"
                >
                  {item.id === "languages" ? (
                    <i className="fa-solid fa-passport" />
                  ) : item.id === "guide" ? (
                    <i className="fa-solid fa-tv" />
                  ) : (
                    <Image
                      src={headIconSrc}
                      alt=""
                      width={40}
                      height={40}
                      sizes="40px"
                      className="ace-header__head"
                      style={{
                        width: "40px",
                        height: "auto",
                      }}
                      unoptimized
                    />
                  )}
                </span>

                {/* COMIC SPEECH BUBBLE */}
                <span
                  className="ace-header__bubble"
                  aria-hidden="true"
                >
                  <span className="ace-header__bubble-title">
                    {item.title}
                  </span>
                  <span className="ace-header__bubble-caption">
                    {item.subtitle}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        {/* RIGHT ACTIONS */}
        <div className="ace-header__actions">
          <Link
            href={signUpHref}
            className="ace-header__signup"
          >
            <span>Sign Up</span>
            <i
              className="fa-solid fa-square-up-right"
              aria-hidden="true"
            />
          </Link>

          <LoginButton href={loginHref} />
        </div>
      </div>
    </header>
  );
}
