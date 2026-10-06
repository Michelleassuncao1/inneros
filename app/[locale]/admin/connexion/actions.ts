"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { langueValide } from "@/i18n/locale";

export type EtatConnexionAdmin = { erreur?: "invalide" | "bloque" };

export async function connexionAdmin(
  locale: string,
  _etat: EtatConnexionAdmin,
  formData: FormData,
): Promise<EtatConnexionAdmin> {
  const langue = langueValide(locale);
  try {
    await signIn("admin", {
      email: formData.get("email"),
      password: formData.get("password"),
      code: formData.get("code"),
      redirectTo: `/${langue}/admin`,
    });
  } catch (e) {
    if (e instanceof CredentialsSignin) {
      return { erreur: e.code === "bloque" ? "bloque" : "invalide" };
    }
    if (e instanceof AuthError) return { erreur: "invalide" };
    throw e; // redirection après succès
  }
  return {};
}
