
import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AccountRole = "admin" | "learner";

export type AuthenticatedAccount = {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  role: AccountRole;
};

export function homeForRole(role: AccountRole): string {
  return role === "admin" ? "/admin" : "/dashboard";
}

export async function getAuthenticatedAccount(): Promise<
  AuthenticatedAccount | null
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, username, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    // Fail closed if the profile cannot be verified.
    throw new Error(
      "Your account profile is unavailable. Contact the administrator."
    );
  }

  if (profile.role !== "admin" && profile.role !== "learner") {
    throw new Error("Invalid account role.");
  }

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile.display_name,
    username: profile.username,
    role: profile.role,
  };
}

export async function requireAccount(
  requiredRole?: AccountRole
): Promise<AuthenticatedAccount> {
  const account = await getAuthenticatedAccount();

  if (!account) {
    redirect("/login");
  }

  if (requiredRole && account.role !== requiredRole) {
    redirect(homeForRole(account.role));
  }

  return account;
}
