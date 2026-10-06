"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { langueValide } from "@/i18n/locale";

export type EtatLien = { erreur?: "expire" };

export async function ouvrirEspace(
  locale: string,
  _etat: EtatLien,
  formData: FormData,
): Promise<EtatLien> {
  try {
    await signIn("lien", {
      token: formData.get("token"),
      redirectTo: `/${langueValide(locale)}/espace`,
    });
  } catch (e) {
    if (e instanceof AuthError) return { erreur: "expire" };
    throw e; // redirection après succès
  }
  return {};
}
