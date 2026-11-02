"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { langueValide } from "@/i18n/locale";
import { demanderLienMagique } from "@/lib/auth/lien-magique";
import { getDb } from "@/lib/db/client";
import { envoyerEmail } from "@/lib/email/brevo";
import { emailLienMagique } from "@/lib/email/lien-magique";
import { adresseClient, compter } from "@/lib/securite/limite-requetes";

export type EtatDemandeLien = { envoye?: boolean; erreur?: "email" };

const adresse = z.string().trim().email().max(254);

export async function demanderLien(
  locale: string,
  _etat: EtatDemandeLien,
  formData: FormData,
): Promise<EtatDemandeLien> {
  const email = adresse.safeParse(formData.get("email"));
  if (!email.success) return { erreur: "email" };
  const langue = langueValide(locale);
  // Trop de demandes depuis cet appareil : même réponse, mais aucun e-mail n'est envoyé
  if (!(await compter(getDb(), "lien", adresseClient(await headers())))) return { envoye: true };

  try {
    await demanderLienMagique(getDb(), email.data, async (destinataire, jeton) => {
      await envoyerEmail(await emailLienMagique(langue, destinataire, jeton));
    });
  } catch (e) {
    // Même réponse dans tous les cas : ne jamais révéler si l'adresse existe
    console.error("Envoi du lien de connexion impossible", e);
  }
  return { envoye: true };
}
