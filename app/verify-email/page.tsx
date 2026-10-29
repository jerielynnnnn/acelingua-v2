"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  Clock3,
  Loader2,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const EMAIL_STORAGE_KEY = "acelingua_pending_verification_email";
const CONFIRMATION_REDIRECT = "/auth/callback?next=/auth/continue";
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Sign-up saves only the email, never the password.
    try {
      setEmail(window.sessionStorage.getItem(EMAIL_STORAGE_KEY) ?? "");
    } catch {
      // Users with storage disabled can enter their email manually.
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((current) => Math.max(0, current - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resendVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || cooldown > 0) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter the email address you used to register.");
      return;
    }

    setSending(true);
    setError("");
    setMessage("");

    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email: cleanEmail,
        options: {
          emailRedirectTo: `${window.location.origin}${CONFIRMATION_REDIRECT}`,
        },
      });

      if (resendError) throw resendError;

      try {
        window.sessionStorage.setItem(EMAIL_STORAGE_KEY, cleanEmail);
      } catch {
        // This is optional state for convenience, not a requirement.
      }

      // Does not incorrectly claim an account was newly created or verified.
      setMessage(
        "If this email has a pending registration, a new verification email should arrive shortly. Please also check Spam or Junk."
      );
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (caught) {
      const detail =
        caught instanceof Error ? caught.message : "Unable to resend email.";
      setError(
        /rate limit|too many requests|over_email_send_rate_limit/i.test(detail)
          ? "Too many email requests. Please try again later."
          : detail
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[linear-gradient(124deg,#f9f2ff_0%,#e6f7ff_29%,#eeeafd_61%,#fff0e9_100%)] px-4 py-12 text-[#2A255C] sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-[440px] w-[440px] rounded-full bg-[#C7A9D4]/25 blur-[100px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 h-[440px] w-[440px] rounded-full bg-[#85D8FA]/30 blur-[100px]"
      />

      <Link
        href="/register"
        className="absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/60 px-4 py-2.5 text-xs font-bold text-[#3558AE] shadow-sm backdrop-blur-xl transition hover:bg-white/95 focus-visible:outline-2 focus-visible:outline-[#3558AE] sm:left-9 sm:top-8"
      >
        <ArrowLeft size={16} /> Back to Register
      </Link>

      <div className="relative z-10 mx-auto grid w-full max-w-[960px] items-center gap-8 md:grid-cols-[0.85fr_1.15fr] md:gap-10">
        <div className="hidden flex-col items-center text-center md:flex">
          <div className="relative grid h-[270px] w-[270px] place-items-center rounded-full bg-white/30 shadow-[0_20px_65px_rgba(99,83,153,0.08)]">
            <span className="absolute inset-5 rounded-full border border-dashed border-[#9270c1]/25" />
            <span className="absolute right-3 top-9 rounded-2xl border border-white bg-white/90 px-3 py-2 text-xs font-extrabold shadow-md">
              Check your inbox! 💌
            </span>
            <Image
              src="/icon head.png"
              alt="ACE, the ACELINGUA mascot"
              width={230}
              height={230}
              sizes="230px"
              className="relative h-auto w-[220px] object-contain drop-shadow-[0_15px_18px_rgba(53,88,174,0.15)]"
              priority
            />
          </div>
          <p className="mt-5 text-sm font-bold text-[#3558AE]">
            ACE is cheering for you! 🐾
          </p>
          <p className="mt-2 max-w-[300px] text-xs leading-6 text-[#706A8D]">
            Just one more step before your language-learning adventure begins.
          </p>
        </div>

        <section
          aria-labelledby="verify-title"
          className="rounded-[30px] border border-white/85 bg-white/75 p-6 shadow-[0_28px_80px_rgba(53,88,174,0.12)] backdrop-blur-2xl sm:p-9"
        >
          <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#e8efff] text-[#3558AE] shadow-[0_9px_20px_rgba(53,88,174,0.1)]">
            <MailCheck size={32} strokeWidth={1.8} />
          </div>

          <div className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#B64074]">
            <Sparkles size={14} /> Almost there!
          </div>
          <h1
            id="verify-title"
            className="text-[30px] font-extrabold tracking-tight text-[#071A4A] sm:text-[36px]"
          >
            Verify your email
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#706A8D]">
            If your registration is new, we have requested a verification email.
            Open the message from ACELINGUA and click the confirmation link.
            You can then continue to sign in or finish onboarding.
          </p>

          <div className="my-7 grid grid-cols-3 gap-2" aria-label="Registration steps">
            <div className="rounded-xl bg-[#e5f5ed] px-2 py-3 text-center text-xs font-extrabold text-[#237b54]">
              <Check className="mx-auto mb-1" size={17} /> Sign up
            </div>
            <div className="rounded-xl border border-[#cbdafc] bg-[#edf3ff] px-2 py-3 text-center text-xs font-extrabold text-[#3558AE]">
              <MailCheck className="mx-auto mb-1" size={17} /> Verify
            </div>
            <div className="rounded-xl bg-[#f6f4fb] px-2 py-3 text-center text-xs font-extrabold text-[#918aa4]">
              <CircleCheck className="mx-auto mb-1" size={17} /> Explore
            </div>
          </div>

          <form onSubmit={resendVerification} className="space-y-3">
            <label htmlFor="verification-email" className="block text-xs font-bold text-[#071A4A]/75">
              Email address
            </label>
            <input
              id="verification-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="h-12 w-full rounded-xl border border-[#3558AE]/15 bg-white/90 px-4 text-sm text-[#071A4A] outline-none transition focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/10"
            />

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="rounded-xl border border-[#c5e6d6] bg-[#effbf5] px-4 py-3 text-xs leading-5 text-[#237b54]">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={sending || cooldown > 0}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3558AE] px-4 text-sm font-bold text-white shadow-[0_8px_23px_rgba(53,88,174,0.15)] transition hover:-translate-y-0.5 hover:bg-[#2A255C] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:transition-none"
            >
              {sending ? (
                <><Loader2 size={16} className="animate-spin" /> Sending...</>
              ) : cooldown > 0 ? (
                <><Clock3 size={16} /> Resend in {cooldown}s</>
              ) : (
                <><RefreshCw size={16} /> Resend verification email</>
              )}
            </button>
          </form>

          <Link
            href="/login"
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#3558AE]/20 bg-white/85 text-sm font-bold text-[#3558AE] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-[#3558AE]"
          >
            Already verified? Go to Login <ArrowRight size={16} />
          </Link>

          <div className="mt-6 flex items-start gap-2 border-t border-[#071A4A]/10 pt-5 text-xs leading-6 text-[#77728F]">
            <ShieldCheck size={17} className="mt-1 shrink-0 text-[#3558AE]" />
            <span>
              Didn&apos;t receive anything? Check Spam or Junk and confirm you
              entered the correct address. If you already have an account,
              sign in instead of registering again.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
