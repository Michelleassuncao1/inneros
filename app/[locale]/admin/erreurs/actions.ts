"use server";

// Onglet « Erreurs » : marquer une erreur comme traitée. L'action revérifie l'administrateur.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { langueValide } from "@/i18n/locale";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { marquerErreurTraitee } from "@/lib/erreurs/journal";

export async function traiterErreur(locale: string, id: string) {
  const langue = langueValide(locale);
  await exigerAdmin(langue);
  const saisie = z.string().uuid().safeParse(id);
  if (!saisie.success) return;
  await marquerErreurTraitee(getDb(), saisie.data);
  revalidatePath(`/${langue}/admin/erreurs`);
}
