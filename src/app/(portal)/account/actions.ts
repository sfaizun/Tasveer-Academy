"use server";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string; ok?: boolean } | null;

export async function changePassword(_prev: State, formData: FormData): Promise<State> {
  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword) return { error: "Enter your current password." };
  if (newPassword.length < 8) return { error: "New password must be at least 8 characters." };
  if (newPassword !== confirmPassword) return { error: "New passwords do not match." };
  if (newPassword === currentPassword) return { error: "Choose a different password than your current one." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Could not verify your account. Please sign in again." };

  // Re-verify the current password before allowing the change, rather than trusting
  // that having an active session alone is enough (e.g. a shared computer).
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) return { error: "Your current password is incorrect." };

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) return { error: "Could not update your password — " + updateError.message };

  return { ok: true };
}
