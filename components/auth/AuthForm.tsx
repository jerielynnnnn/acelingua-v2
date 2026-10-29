"use client";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Cloud,
  Eye,
  EyeOff,
  Home,
  Languages,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  POST_AUTH_ROUTE,
  registrationOnboardingMetadata,
} from "@/lib/auth-boarding";
import { readPreview } from "@/lib/guest-preview";
type AuthMode = "login" | "register" | "forgot" | "reset";
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

const underlineClass =
  "pointer-events-none absolute -bottom-px left-0 z-10 h-[2px] " +
  "w-full origin-left scale-x-0 bg-[#3558AE] " +
  "transition-transform duration-[350ms] " +
  "ease-[cubic-bezier(0.22,1,0.36,1)] " +
  "group-focus-within:scale-x-100 motion-reduce:transition-none";

const fieldClass =
  "relative h-11 w-full border-0 bg-transparent px-0 " +
  "text-sm text-[#071A4A] outline-none " +
  "placeholder:text-[#071A4A]/35 focus:outline-none focus:ring-0";

const labelClass =
  "mb-2 block text-xs font-bold text-[#071A4A]/70";

// Give each route its own stateful form instance. Next.js may reuse a client
// component when navigating between /login and /register; keying by mode
// guarantees a fresh form and replays the entrance transition on every switch.
export default function AuthForm({ mode }: Props) {
  return <AuthFormScreen key={mode} mode={mode} />;
}

function AuthFormScreen({ mode }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginNeedsVerification, setLoginNeedsVerification] = useState(false);
  const [success, setSuccess] = useState("");
  const content = pageContent[mode];
  const busy = loading || googleLoading;
  const isScene = mode === "login" || mode === "register";
  const isRegister = mode === "register";
  // One-viewport layout for login and registration.

  useEffect(() => {
    if (!isScene) return;
    const previousHtml = document.documentElement.style.overflow;
    const previousBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousHtml;
      document.body.style.overflow = previousBody;
    };
  }, [isScene]);

  // Registration only starts after the user submits the form.

  function readableError(caught: unknown) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Something went wrong. Please try again.";
    if (
      /email rate limit exceeded|over_email_send_rate_limit/i.test(
        message
      )
    ) {
      return (
        "Email verification is temporarily unavailable because " +
        "the sending limit has been reached. Please try again later."
      );
    }
    if (/user already registered|already been registered/i.test(message)) {
      return "This email may already have an account. Please sign in or use Forgot password instead.";
    }
    if (/email not confirmed|email not verified/i.test(message)) {
      return "Please verify your email address before signing in. Check your inbox or request another verification email.";
    }
    return message;
  }

  // ==========================================================

  // EMAIL / PASSWORD AUTHENTICATION

  // ==========================================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setLoading(true);
    setError("");
    setSuccess("");
    setLoginNeedsVerification(false);
    try {
      const supabase = createClient();

      // LOGIN
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

      // REGISTER
      if (mode === "register") {
        const cleanUsername = username.trim();
        if (cleanUsername.length < 2) {
          throw new Error(
            "Username must contain at least 2 characters."
          );
        }
        if (password.length < 8) {
          throw new Error(
            "Password must contain at least 8 characters."
          );
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        // Preserve the existing onboarding and guest-preview data.
        const onboarding = registrationOnboardingMetadata();
        const preview = readPreview();
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo:
                `${window.location.origin}/auth/callback`,
              data: {
                username: cleanUsername,
                display_name: cleanUsername,
                acelingua_onboarding: {
                  ...onboarding,
                  ...(onboarding.source === "guest_preview" &&
                  preview?.completed
                    ? { courseId: preview.courseId }
                    : {}),
                },
                acelingua_guest_preview:
                  preview?.completed ? preview : null,
              },
            },
          });
        if (signUpError) throw signUpError;
        if (!data.user) {
          throw new Error("Registration could not be completed. Please try again.");
        }
        // Supabase returns no session when email confirmation is required.
        // NEVER call this a completed login just because signUp returned a user.
        if (!data.session) {
          // Keep only the email (never the password) for the verification screen.
          try {
            window.sessionStorage.setItem(
              "acelingua_pending_verification_email",
              email.trim().toLowerCase()
            );
          } catch {
            // Storage can be disabled; the next page also accepts manual email entry.
          }
          router.replace("/verify-email");
          return;
        }
        // When Confirm email is disabled in Supabase, signUp creates a real
        // session. Continue with the existing onboarding / role-based route.
        router.replace(POST_AUTH_ROUTE);
        router.refresh();
        return;
      }

      // FORGOT PASSWORD
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
          "If an account exists for this email, you will receive a password recovery link."
        );
        return;
      }

      // RESET PASSWORD
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
            "Your recovery session is invalid or expired. Request a new password recovery email."
          );
        }
        const { error: updateError } =
          await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await supabase.auth.signOut();
        setSuccess(
          "Password updated! Please sign in with your new password."
        );
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      if (mode === "login" && /email not confirmed|email not verified/i.test(message)) {
        setLoginNeedsVerification(true);
        try {
          window.sessionStorage.setItem(
            "acelingua_pending_verification_email",
            email.trim().toLowerCase()
          );
        } catch {
          // Storage may be unavailable.
        }
      }
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================

  // GOOGLE AUTHENTICATION

  // ==========================================================

  async function handleGoogleAuth() {
    if (busy) return;
    setGoogleLoading(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      if (mode === "register") {
        try {
          localStorage.setItem(
            "acelingua_registration_pending",
            "true"
          );
        } catch {
          // OAuth does not require local storage to succeed.
        }
      }
      const callback =
        `${window.location.origin}/auth/callback`;
      const redirectTo =
        mode === "register"
          ? callback
          : `${callback}?next=/auth/continue`;
      const { error: oauthError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });
      if (oauthError) throw oauthError;
    } catch (caught) {
      setError(readableError(caught));
      setGoogleLoading(false);
    }
  }

  // ==========================================================

  // Route switches use normal Next.js <Link> navigation. No delayed router.push,
  // exit timer, or sticky opacity: 0; the keyed form remounts and fades in.

  // ==========================================================

  // SHARED ANIMATED LOGIN / REGISTER DESIGN

  // ==========================================================
  if (isScene) {
    return (
      <main className="acel-login-scene fixed inset-0 z-[100] isolate h-[100dvh] w-full overflow-hidden text-[#102452]">
        {/* Animated background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="acel-login-aurora-one absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-[#C7A9D4]/40 blur-[100px]" />
          <div className="acel-login-aurora-two absolute -right-28 top-[14%] h-[500px] w-[580px] rounded-full bg-[#85D8FA]/35 blur-[100px]" />
          <div className="acel-login-aurora-three absolute bottom-[-190px] left-[32%] h-[490px] w-[550px] rounded-full bg-[#FF9297]/20 blur-[100px]" />
          <Cloud
            className="acel-cloud-one absolute left-[5%] top-[15%] h-16 w-24 text-white/70 drop-shadow-md"
            strokeWidth={1.3}
          />
          <Cloud
            className="acel-cloud-two absolute left-[44%] top-[11%] h-12 w-20 text-white/60"
            strokeWidth={1.3}
          />
          <Cloud
            className="acel-cloud-three absolute bottom-[14%] left-[8%] h-14 w-24 text-white/65"
            strokeWidth={1.3}
          />
          <Cloud
            className="acel-cloud-four absolute bottom-[10%] right-[6%] h-16 w-28 text-white/55"
            strokeWidth={1.3}
          />
          <Star className="acel-login-twinkle absolute left-[15%] top-[31%] h-6 w-6 fill-[#FFD46E] text-[#E6A746]" />
          <Sparkles className="acel-login-twinkle-late absolute right-[9%] top-[23%] h-6 w-6 text-[#E798BA]" />
          {!isRegister && (
            <Languages className="acel-login-twinkle absolute bottom-[21%] right-[13%] h-6 w-6 text-[#3558AE]/50" />
          )}
        </div>
        {/* Home button */}
        <div className="absolute left-4 top-4 z-30 sm:left-8 sm:top-7 lg:left-12">
          <Link
            href="/"
            aria-label="Back to ACELINGUA homepage"
            className="group inline-flex h-11 items-center gap-2 rounded-full border border-white/75 bg-white/55 px-4 text-xs font-extrabold text-[#102452] shadow-[0_8px_25px_rgba(35,64,116,.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-[0_12px_25px_rgba(53,88,174,.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3558AE]"
          >
            <Home
              size={16}
              aria-hidden="true"
              className="transition-transform group-hover:-translate-x-0.5"
            />
            <span>Home</span>
          </Link>
        </div>
        {/* Main grid */}
        <div className="acel-login-layout relative z-10 mx-auto grid h-full w-full max-w-[1440px] grid-cols-1 items-center gap-0 px-4 pb-3 pt-[64px] sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-12 lg:pb-8 lg:pt-[76px]">
          {/* Ace mascot */}
          <section
            aria-label="Ace welcomes you"
            className="relative mx-auto flex h-[clamp(128px,22dvh,190px)] w-full max-w-[580px] items-center justify-center lg:h-full lg:min-h-0"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 m-auto h-[min(54dvh,480px)] w-[min(54dvh,480px)] rounded-full bg-[radial-gradient(circle,rgba(133,216,250,.32),rgba(199,169,212,.16)_55%,transparent_75%)] blur-xl"
            />
            <div className="acel-mascot-fixed relative flex h-full w-[min(100%,510px)] items-center justify-center lg:h-[min(65dvh,550px)]">
              <div className="absolute left-[24%] top-[13%] z-20 lg:left-[33%] lg:top-[8%]">
                <div className="relative whitespace-nowrap rounded-[20px] border border-white/80 bg-white/85 px-4 py-2.5 text-[13px] font-black text-[#102452] shadow-[0_12px_30px_rgba(53,88,174,.15)] backdrop-blur-xl sm:text-sm lg:px-6 lg:py-4 lg:text-[19px]">
                  Hello, Explorer!{" "}
                  <span aria-hidden="true">👋</span>
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-[7px] left-[38%] h-3.5 w-3.5 rotate-45 border-b border-r border-white/80 bg-white/85"
                  />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-[-11%] top-[16%] flex items-center justify-center lg:bottom-[4%] lg:top-[17%]">
                <Image
                  src="/icon head.png"
                  alt="Ace, the ACELINGUA mascot"
                  width={570}
                  height={570}
                  priority
                  sizes="(min-width: 1024px) 520px, 240px"
                  className="h-full w-full max-w-[min(64vw,245px)] object-contain drop-shadow-[0_20px_23px_rgba(69,92,172,.20)] lg:max-w-[520px]"
                />
              </div>
            </div>
            <p className="absolute bottom-5 left-1/2 hidden w-max max-w-full -translate-x-1/2 text-center text-sm font-semibold text-[#53658e] lg:block">
              Hi I&apos;m ACE, Nice to meet you ^-^
            </p>
          </section>
          {/* Glass form */}
          <section
            aria-label={
              isRegister ? "Create account" : "Sign in"
            }
            className="relative mx-auto flex min-h-0 w-full max-w-[520px] items-center justify-center overflow-y-auto overscroll-contain rounded-[28px] border border-white/75 bg-white/65 px-5 py-5 shadow-[0_28px_80px_rgba(53,88,174,.12)] backdrop-blur-2xl sm:px-9 sm:py-7 lg:max-h-[calc(100dvh-130px)] lg:rounded-[32px] lg:px-10 lg:py-9"
          >
            <div
              className={`${
                isRegister ? "acel-register-form" : "acel-login-form"
              } acel-auth-motion w-full max-w-[390px]`}
            >
              {/* Heading */}
              <div className={isRegister ? "mb-5" : "mb-7"}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3558AE]">
                  {isRegister
                    ? "YOUR ADVENTURE BEGINS"
                    : "YOUR JOURNEY CONTINUES"}
                </p>
                <h1 className="mt-2 text-[30px] font-extrabold tracking-tight text-[#071A4A]">
                  {isRegister
                    ? "Create your account"
                    : "Sign in to ACELINGUA"}
                </h1>
              </div>
              {/* Google authentication */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={busy}
                className="group flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#071A4A]/10 bg-white/90 text-sm font-semibold text-[#102452] shadow-[0_4px_16px_rgba(53,88,174,0.07)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#3558AE]/25 hover:bg-white hover:shadow-[0_10px_24px_rgba(53,88,174,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3558AE]/45 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {googleLoading ? (
                  <Loader2
                    size={18}
                    className="animate-spin text-[#3558AE]"
                    aria-hidden="true"
                  />
                ) : (
                  <GoogleIcon />
                )}
                <span>
                  {googleLoading
                    ? "Connecting to Google..."
                    : "Continue with Google"}
                </span>
              </button>
              {/* Divider */}
              <div
                className={`flex items-center gap-3 ${
                  isRegister ? "my-4" : "my-6"
                }`}
              >
                <span className="h-px flex-1 bg-[#071A4A]/10" />
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#071A4A]/35">
                  {isRegister
                    ? "or sign up with email"
                    : "or continue with email"}
                </span>
                <span className="h-px flex-1 bg-[#071A4A]/10" />
              </div>
              {/* Error and success messages */}
              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-600"
                >
                  {error}
                  {mode === "login" && loginNeedsVerification && (
                    <Link
                      href="/verify-email"
                      className="mt-2 inline-flex items-center gap-1 font-bold underline underline-offset-2"
                    >
                      Resend verification email <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              )}
              {success && (
                <div
                  role="status"
                  className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-5 text-green-700"
                >
                  {success}
                </div>
              )}
              {/* A registration is started only by submitting this form. */}
              <form
                  onSubmit={handleSubmit}
                  className={isRegister ? "space-y-4" : ""}
                >
                  {/* Username */}
                  {isRegister && (
                    <div>
                      <label
                        htmlFor="auth-username"
                        className={labelClass}
                      >
                        Username
                      </label>
                      <div className="group relative border-b border-[#071A4A]/15">
                        <span
                          aria-hidden="true"
                          className={underlineClass}
                        />
                        <input
                          id="auth-username"
                          type="text"
                          value={username}
                          onChange={(e) =>
                            setUsername(e.target.value)
                          }
                          placeholder="Choose a username"
                          required
                          minLength={2}
                          maxLength={120}
                          autoComplete="username"
                          className={fieldClass}
                        />
                      </div>
                    </div>
                  )}
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="auth-email"
                      className={labelClass}
                    >
                      Email address
                    </label>
                    <div className="group relative border-b border-[#071A4A]/15">
                      <span
                        aria-hidden="true"
                        className={underlineClass}
                      />
                      <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) =>
                          setEmail(e.target.value)
                        }
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                        className={fieldClass}
                      />
                    </div>
                  </div>
                  {/* Password */}
                  <div className={isRegister ? "" : "mt-4"}>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="auth-password"
                        className="text-xs font-bold text-[#071A4A]/70"
                      >
                        Password
                      </label>
                      {!isRegister && (
                        <Link
                          href="/forgot-password"
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#3558AE]/20 bg-[#EAF5FF] px-3 py-2 text-xs font-bold text-[#3558AE] transition hover:border-[#3558AE]/40 hover:bg-[#DCEEFF]"
                        >
                          Forgot password?
                        </Link>
                      )}
                    </div>
                    <div className="group relative border-b border-[#071A4A]/15">
                      <span
                        aria-hidden="true"
                        className={underlineClass}
                      />
                      <input
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) =>
                          setPassword(e.target.value)
                        }
                        placeholder={
                          isRegister
                            ? "At least 8 characters"
                            : "Enter your password"
                        }
                        required
                        minLength={isRegister ? 8 : 1}
                        autoComplete={
                          isRegister
                            ? "new-password"
                            : "current-password"
                        }
                        className={`${fieldClass} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev) => !prev)
                        }
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        aria-pressed={showPassword}
                        className="absolute right-1 top-1/2 z-20 -translate-y-1/2 text-[#071A4A]/30 transition hover:text-[#3558AE]"
                      >
                        {showPassword ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                  </div>
                  {/* Confirm password */}
                  {isRegister && (
                    <div>
                      <label
                        htmlFor="auth-confirm-password"
                        className={labelClass}
                      >
                        Confirm password
                      </label>
                      <div className="group relative border-b border-[#071A4A]/15">
                        <span
                          aria-hidden="true"
                          className={underlineClass}
                        />
                        <input
                          id="auth-confirm-password"
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) =>
                            setConfirmPassword(e.target.value)
                          }
                          placeholder="Enter your password again"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          className={fieldClass}
                        />
                      </div>
                    </div>
                  )}
                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={busy}
                    className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#071A4A] text-sm font-bold text-white shadow-[0_8px_20px_rgba(7,26,74,0.14)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#3558AE] disabled:cursor-not-allowed disabled:opacity-60 ${
                      isRegister ? "mt-2" : "mt-6"
                    }`}
                  >
                    {loading && (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    )}
                    {loading
                      ? isRegister
                        ? "Creating account..."
                        : "Signing in..."
                      : isRegister
                        ? "Create account"
                        : "Sign in"}
                    {!loading && <ArrowRight size={15} />}
                  </button>
                </form>
              {/* Switch login/register */}
              <p className="mt-6 text-center text-xs text-[#071A4A]/40">
                {isRegister
                  ? "Already have an account? "
                  : "New to ACELINGUA? "}
                <Link
                  href={isRegister ? "/login" : "/register"}
                  className="font-bold text-[#3558AE] transition hover:text-[#071A4A]"
                >
                  {isRegister ? "Log in" : "Create an account"}
                </Link>
              </p>
            </div>
          </section>
        </div>
        {/* Login and register animation styles */}
        <style jsx global>{`
          .acel-login-scene {
            background: linear-gradient(
              124deg,
              #f9f2ff 0%,
              #e6f7ff 29%,
              #eeeafd 61%,
              #fff0e9 100%
            );
            background-size: 220% 220%;
            animation: acel-login-gradient 24s ease-in-out infinite alternate;
          }
          .acel-login-aurora-one {
            animation: acel-login-aurora 19s ease-in-out infinite alternate;
          }
          .acel-login-aurora-two {
            animation: acel-login-aurora 22s -6s ease-in-out infinite alternate-reverse;
          }
          .acel-login-aurora-three {
            animation: acel-login-aurora 25s -8s ease-in-out infinite alternate;
          }
          .acel-cloud-one {
            animation: acel-login-cloud 9s ease-in-out infinite alternate;
          }
          .acel-cloud-two {
            animation: acel-login-cloud 13s -5s ease-in-out infinite alternate-reverse;
          }
          .acel-cloud-three {
            animation: acel-login-cloud 11s -2s ease-in-out infinite alternate;
          }
          .acel-cloud-four {
            animation: acel-login-cloud 14s -7s ease-in-out infinite alternate-reverse;
          }
          .acel-login-twinkle {
            animation: acel-login-sparkle 4s ease-in-out infinite;
          }
          .acel-login-twinkle-late {
            animation: acel-login-sparkle 4.5s -1.5s ease-in-out infinite;
          }
          .acel-auth-motion {
            animation: acel-auth-arrive 420ms cubic-bezier(.22,1,.36,1) both;
          }
          @keyframes acel-login-gradient {
            from { background-position: 0% 30%; }
            to { background-position: 100% 70%; }
          }
          @keyframes acel-login-aurora {
            from {
              transform: translate3d(-16px,12px,0) scale(1);
            }
            to {
              transform: translate3d(22px,-20px,0) scale(1.12);
            }
          }
          @keyframes acel-login-cloud {
            from {
              transform: translate3d(0,0,0);
            }
            to {
              transform: translate3d(28px,-12px,0);
            }
          }
          @keyframes acel-login-sparkle {
            0%, 100% {
              opacity: .45;
              transform: scale(.85);
            }
            50% {
              opacity: 1;
              transform: scale(1.12);
            }
          }
          @keyframes acel-auth-arrive {
            from {
              opacity: 0;
              transform: translate3d(0,18px,0) scale(.985);
            }
            to {
              opacity: 1;
              transform: translate3d(0,0,0) scale(1);
            }
          }
          @media (max-width: 1023px) {
            .acel-login-layout {
              grid-template-rows: auto minmax(0,1fr);
            }
            .acel-login-scene section[aria-label="Sign in"],
            .acel-login-scene section[aria-label="Create account"] {
              max-height: 100%;
            }
          }
          @media (max-height: 730px) and (min-width: 1024px) {
            .acel-login-form { zoom: .91; }
          }
          @media (max-height: 620px) and (min-width: 1024px) {
            .acel-login-form { zoom: .80; }
          }
          @media (max-height: 890px) and (min-width: 1024px) {
            .acel-register-form { zoom: .92; }
          }
          @media (max-height: 770px) and (min-width: 1024px) {
            .acel-register-form { zoom: .82; }
          }
          @media (max-height: 640px) and (min-width: 1024px) {
            .acel-register-form { zoom: .72; }
          }
          @media (max-height: 850px) and (max-width: 1023px) {
            .acel-login-scene section[aria-label="Ace welcomes you"] {
              height: 105px;
            }
            .acel-login-scene section[aria-label="Sign in"],
            .acel-login-scene section[aria-label="Create account"] {
              padding-top: 14px;
              padding-bottom: 14px;
            }
            .acel-login-form,
            .acel-register-form {
              zoom: .91;
            }
          }
          @media (max-height: 700px) and (max-width: 1023px) {
            .acel-login-scene section[aria-label="Ace welcomes you"] {
              height: 76px;
            }
            .acel-login-form,
            .acel-register-form {
              zoom: .80;
            }
          }
          @media (max-height: 570px) and (max-width: 1023px) {
            .acel-login-scene section[aria-label="Ace welcomes you"] {
              height: 66px;
            }
            .acel-register-form {
              zoom: .72;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .acel-login-scene,
            .acel-login-aurora-one,
            .acel-login-aurora-two,
            .acel-login-aurora-three,
            .acel-cloud-one,
            .acel-cloud-two,
            .acel-cloud-three,
            .acel-cloud-four,
            .acel-login-twinkle,
            .acel-login-twinkle-late,
            .acel-auth-motion {
              animation: none !important;
            }
          }
        `}</style>
      </main>
    );
  }

  // ==========================================================

  // EXISTING FORGOT / RESET PASSWORD DESIGN

  // ==========================================================
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
            {mode === "forgot" && (
              <div>
                <label
                  htmlFor="recovery-email"
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
                    id="recovery-email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none transition focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/10"
                  />
                </div>
              </div>
            )}
            {mode === "reset" && (
              <>
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-2 block text-sm font-semibold"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      size={19}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Enter your new password"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-12 outline-none transition focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(!showPassword)
                      }
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
                <div>
                  <label
                    htmlFor="confirm-new-password"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Repeat your new password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-[#3558AE] focus:ring-2 focus:ring-[#3558AE]/10"
                  />
                </div>
              </>
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
            <Link
              href="/login"
              className="font-bold text-[#3558AE] hover:underline"
            >
              Back to Login
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Learn. Speak. Explore.
        </p>
      </div>
    </main>
  );
}

// ==========================================================

// GOOGLE ICON

// ==========================================================

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.37Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.4l-3.24-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.12-1.32.31-1.92V7.49H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.51l3.35-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.96 2.96 14.7 2 12 2a10 10 0 0 0-8.96 5.49l3.35 2.59C7.18 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  );
}
