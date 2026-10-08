// Contrôle d'accès côté serveur, à appeler en tête de chaque page protégée.
// La session seule ne suffit pas : le rôle et l'état du compte sont relus en base à chaque requête.
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

async function utilisateurActif(role: "admin" | "referent") {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== role) return null;
  const [user] = await getDb().select().from(users).where(eq(users.id, session.user.id));
  if (!user || user.role !== role || user.disabledAt) return null;
  return user;
}

// Pour les routes de téléchargement (PDF) : renvoie l'administrateur ou null, sans redirection
export async function adminConnecte() {
  return utilisateurActif("admin");
}

export async function exigerAdmin(locale: string) {
  const user = await utilisateurActif("admin");
  if (!user) redirect(`/${locale}/admin/connexion`);
  return user;
}

export async function exigerReferent(locale: string) {
  const user = await utilisateurActif("referent");
  if (!user) redirect(`/${locale}/espace/connexion`);
  return user;
}
