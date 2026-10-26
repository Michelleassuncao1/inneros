// Formation « IMA Talks — Utiliser l'IA dans InnerOS » (article 4 AI Act) : parcours interactif, puis
// enregistrement qui débloque la validation des contenus préparés avec l'IA, et certificat IMA.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { ParcoursFormation } from "@/components/formation/ParcoursFormation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { formation, formationPublique, GUIDE, lireProgression } from "@/lib/formation/formation";

export default async function FormationIAPage({ params }: PageProps<"/[locale]/admin/formation-ia">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  const t = await getTranslations("FormationIA");
  const f = formation();
  const p = await lireProgression(getDb(), admin);

  return (
    <EspaceAdmin locale={locale} actif="formation">
      <TitrePage surtitre={t("title")} titre={f.title} />
      <p className="mb-2 max-w-[70ch] text-ima-muted">{f.scope}</p>
      <p className="mb-8 max-w-[70ch] text-sm text-ima-muted">
        {t("meta", { version: f.version, minutes: f.duration_minutes })} {f.language !== locale && locale !== "fr" ? t("frenchOnly") : ""}
      </p>
      <ParcoursFormation
        locale={locale}
        formation={formationPublique(f)}
        guide={GUIDE}
        aujourdhui={new Date().toISOString().slice(0, 10)}
        etat={{
          guideLu: !!p?.guideAckAt,
          reussi: !!p?.passedAt,
          meilleurScore: p?.bestScore ?? null,
          tentatives: p?.attempts ?? 0,
          enregistre: !!p?.registeredAt,
          certificat: p?.certificateCode ?? null,
        }}
      />
    </EspaceAdmin>
  );
}
