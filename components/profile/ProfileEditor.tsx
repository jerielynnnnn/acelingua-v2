
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  initialDisplayName: string;
  initialUsername: string;
};

export default function ProfileEditor({
  userId,
  initialDisplayName,
  initialUsername,
}: Props) {
  const router = useRouter();

  const [displayName, setDisplayName] =
    useState(initialDisplayName);

  const [username, setUsername] =
    useState(initialUsername);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const cleanDisplayName = displayName.trim();
      const cleanUsername = username.trim();

      if (cleanDisplayName.length < 2) {
        throw new Error(
          "Display name must contain at least 2 characters."
        );
      }

      if (
        cleanUsername &&
        !/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)
      ) {
        throw new Error(
          "Username must have 3–30 letters, numbers, or underscores."
        );
      }

      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user || user.id !== userId) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: cleanDisplayName,
          username: cleanUsername || null,
        })
        .eq("id", user.id)
        .select("id")
        .single();

      if (updateError || !data) {
        throw new Error(
          updateError?.message ?? "Profile update failed."
        );
      }

      setMessage("Your profile was updated successfully.");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save profile."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label
          htmlFor="profile-name"
          className="mb-2 block text-sm font-semibold"
        >
          Display Name
        </label>

        <input
          id="profile-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={120}
          autoComplete="name"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#3558AE]"
        />
      </div>

      <div>
        <label
          htmlFor="profile-username"
          className="mb-2 block text-sm font-semibold"
        >
          Username
        </label>

        <input
          id="profile-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={30}
          autoComplete="username"
          placeholder="Choose a username"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#3558AE]"
        />

        <p className="mt-2 text-xs text-slate-500">
          Letters, numbers, and underscores only.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="text-sm text-green-600">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-[#3558AE] px-6 py-3 font-semibold text-white transition hover:bg-[#2A255C] disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
