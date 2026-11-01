// Contenu de la page « Aide à la rédaction » (module D2), commun à l'espace IMA et à l'espace du conseiller
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { MessageInfo } from "@/components/Formulaire";
import { getDb } from "@/lib/db/client";
import { organizations, type users } from "@/lib/db/schema";
import { aideActivee, LIMITE_PAR_JOUR, utilisationsDuJour } from "@/lib/redaction/aide";
import { AideRedaction } from "./AideRedaction";

export async function EspaceRedaction({ utilisateur, locale }: { utilisateur: typeof users.$inferSelect; locale: string }) {
  const t = await getTranslations("Redaction");
  const db = getDb();
  if (!aideActivee()) return <MessageInfo>{t("disabled")}</MessageInfo>;
  if (utilisateur.organizationId) {
    const [o] = await db.select({ country: organizations.country }).from(organizations).where(eq(organizations.id, utilisateur.organizationId));
    if (o?.country === "BR" && process.env.AI_WRITING_AID_BRAZIL !== "true") return <MessageInfo>{t("countryUnavailable")}</MessageInfo>;
  }
  const restantes = Math.max(0, LIMITE_PAR_JOUR - (await utilisationsDuJour(db, utilisateur)));
  return <AideRedaction locale={locale} restantes={restantes} />;
}
