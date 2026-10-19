// Registre des risques RPS d'une entreprise, côté IMA (module A1)
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { Registre } from "@/components/risques/Registre";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";

export default async function RegistreAdminPage({ params }: PageProps<"/[locale]/admin/entreprises/[id]/risques">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [org] = await getDb().select().from(organizations).where(eq(organizations.id, id));
  if (!org) notFound();
  const t = await getTranslations("Risques");

  return (
    <EspaceAdmin locale={locale} actif="entreprises">
      <TitrePage surtitre={t("title")} titre={org.name} />
      <p className="mb-8">
        <Link href={`/admin/entreprises/${id}`} className="font-semibold text-ima-navy underline">
          {t("back")}
        </Link>
      </p>
      <Registre utilisateur={admin} organizationId={id} locale={locale} base={`/admin/entreprises/${id}/risques`} />
    </EspaceAdmin>
  );
}
