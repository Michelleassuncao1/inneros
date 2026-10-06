"use server";

import { signOut } from "@/auth";
import { langueValide } from "@/i18n/locale";

export async function deconnexion(locale: string) {
  await signOut({ redirectTo: `/${langueValide(locale)}` });
}
