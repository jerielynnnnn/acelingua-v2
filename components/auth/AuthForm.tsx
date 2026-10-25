
"use client";

import {
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type AuthMode =
  | "login"
  | "register"
  | "forgot"
  | "reset";

type Props = {
  mode: AuthMode;
};

const pageContent = {
  login: {
    heading: "Welcome back!",
    description: "Sign in to continue your language adventure.",
    button: "Sign In",
  },
  register: {
    heading: "Join ACELINGUA!",
    description: "Create your account and start exploring languages.",
    button: "Create Account",
  },
  forgot: {
    heading: "Forgot your password?",
    description: "We'll help you recover your account.",
    button: "Send Recovery Email",
  },
  reset: {
    heading: "Create a new password",
    description: "Choose a secure password for your account.",
    button: "Update Password",
  },
};

export default function AuthForm({ mode }: Props) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const content = pageContent[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (signInError) throw signInError;

        router.replace("/auth/continue");
        router.refresh();
        return;
      }

      if (mode === "register") {
        if (displayName.trim().length < 2) {
          throw new Error(
            "Please enter a display name with at least 2 characters."
          );
        }

        if (password.length < 8) {
          throw new Error(
            "Your password must have at least 8 characters."
          );
        }

        if (password !== confirmPassword) {
          throw new Error("The passwords do not match.");
        }

        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                display_name: displayName.trim(),
              },
              emailRedirectTo:
                `${window.location.origin}/auth/callback` +
                "?next=/auth/continue",
            },
          });

        if (signUpError) throw signUpError;

        if (data.session) {
          router.replace("/auth/continue");
          router.refresh();
          return;
        }

        setSuccess(
          "Registration submitted. Check your inbox for a " +
          "confirmation email. If the address is eligible, " +
          "follow the verification link before signing in."
        );

        return;
      }

      if (mode === "forgot") {
        const { error: resetError } =
          await supabase.auth.resetPasswordForEmail(
            email.trim(),
            {
              redirectTo:
                `${window.location.origin}/auth/callback` +
                "?next=/reset-password",
            }
          );

        if (resetError) throw resetError;

        setSuccess(
          "If an account exists for this email, " +
          "you will receive a password recovery link."
        );

        return;
      }

      if (mode === "reset") {
        if (password.length < 8) {
          throw new Error(
            "Your new password must have at least 8 characters."
          );
        }

        if (password !== confirmPassword) {
          throw new Error("The passwords do not match.");
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            "Your recovery session is invalid or expired. " +
            "Request a new password recovery email."
          );
        }

        const { error: updateError } =
          await supabase.auth.updateUser({
            password,
          });

        if (updateError) throw updateError;

        await supabase.auth.signOut();

        setSuccess(
          "Password updated! Please sign in with your new password."
        );

        return;
      }
    } catch (caughtError) {
  const message =
    caughtError instanceof Error
      ? caughtError.message
      : "Something went wrong. Please try again.";

  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(message)) {
    setError(
      "Email verification is temporarily unavailable because " +
      "the sending limit has been reached. Please try again later."
    );
  } else {
    setError(message);
  }
} finally {
  setLoading(false);
}
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f9f2ff] via-[#e6f7ff] to-[#fff0e9] px-4 py-12 text-[#2A255C]">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-3"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3558AE] text-white shadow-lg">
            <BookOpen size={23} />
          </span>

          <span className="text-2xl font-extrabold tracking-tight">
            ACE<span className="text-[#3558AE]">lingua</span>
          </span>
        </Link>

        <div className="rounded-[28px] border border-white/80 bg-white/95 p-7 shadow-[0_20px_80px_rgba(42,37,92,0.1)] sm:p-9">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0edff] text-[#3558AE]">
              <ShieldCheck size={28} />
            </div>

            <h1 className="text-3xl font-bold">
              {content.heading}
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              {content.description}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "register" && (
              <div>
                <label
                  htmlFor="displayName"
                  className="mb-2 block text-sm font-semibold"
                >
                  Display Name
                </label>

                <div className="relative">
                  <UserRound
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Your name"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none transition focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/10"
                  />
                </div>
              </div>
            )}

            {mode !== "reset" && (
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold"
                >
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none transition focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/10"
                  />
                </div>
              </div>
            )}

            {mode !== "forgot" && (
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold"
                >
                  {mode === "reset"
                    ? "New Password"
                    : "Password"}
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === "login" ? 1 : 8}
                    autoComplete={
                      mode === "login"
                        ? "current-password"
                        : "new-password"
                    }
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-12 outline-none transition focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#3558AE]"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>
            )}

            {(mode === "register" || mode === "reset") && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-semibold"
                >
                  Confirm Password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/10"
                />
              </div>
            )}

            {mode === "login" && (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm font-semibold text-[#3558AE] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
              >
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3558AE] px-5 py-3.5 font-semibold text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:bg-[#2A255C] hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Please wait..." : content.button}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-500">
            {mode === "login" ? (
              <>
                New to ACELINGUA?{" "}
                <Link
                  href="/register"
                  className="font-bold text-[#3558AE] hover:underline"
                >
                  Create an account
                </Link>
              </>
            ) : mode === "register" ? (
              <>
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-bold text-[#3558AE] hover:underline"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="font-bold text-[#3558AE] hover:underline"
              >
                Back to Login
              </Link>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Learn. Speak. Explore.
        </p>
      </div>
    </main>
  );
}
