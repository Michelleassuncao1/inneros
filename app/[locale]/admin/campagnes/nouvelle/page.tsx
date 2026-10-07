import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Drapeau } from "@/components/Drapeau";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { actionCreerCampagne } from "../../actions";
import { ChampsCampagne } from "../../ChampsFormulaires";

export default async function NouvelleCampagnePage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/campagnes/nouvelle">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await exigerAdmin(locale);
  const t = await getTranslations("Campagnes");
  const l = await getTranslations("Libelles");

  const { entreprise } = await searchParams;
  const id = z.string().uuid().safeParse(entreprise);
  const [org] = id.success
    ? await getDb().select().from(organizations).where(eq(organizations.id, id.data))
    : [];

  return (
    <EspaceAdmin locale={locale} actif="campagnes">
      <TitrePage surtitre={t("title")} titre={t("new")} />
      {!org ? (
        <p>
          {t("chooseOrganization")}{" "}
          <Link href="/admin/entreprises" className="font-semibold text-ima-navy underline">
            {l("all")}
          </Link>
        </p>
      ) : (
        <>
          <p className="mb-8 flex items-center gap-2 font-semibold text-ima-navy">
            <Drapeau pays={org.country} />
            {t("organization", { name: org.name, country: l(`country.${org.country}`) })}
          </p>
          <FormulaireAction
            action={actionCreerCampagne.bind(null, locale, org.id)}
            libelle={t("create")}
            enCours={t("saving")}
          >
            <ChampsCampagne langueParDefaut={org.locale} />
          </FormulaireAction>
        </>
      )}
    </EspaceAdmin>
  );
}
