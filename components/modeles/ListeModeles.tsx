// Bibliothèque de modèles vierges (module D1), commune à l'espace IMA et à l'espace du conseiller en prévention
import { getTranslations } from "next-intl/server";
import { MessageInfo } from "@/components/Formulaire";
import type { users } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { CATEGORIES_MODELE, modelesVisibles } from "@/lib/modeles/modeles";

const bouton = "inline-block rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream";

export async function ListeModeles({ utilisateur }: { utilisateur: typeof users.$inferSelect }) {
  const t = await getTranslations("Modeles");
  const tl = await getTranslations("Libelles");
  const modeles = await modelesVisibles(getDb(), utilisateur);
  const ima = utilisateur.role === "admin";

  return (
    <div className="flex flex-col gap-8">
      <MessageInfo>{t("privacy")}</MessageInfo>
      {modeles.length === 0 && <p>{t("empty")}</p>}
      {CATEGORIES_MODELE.filter((c) => modeles.some((m) => m.categorie === c)).map((c) => (
        <section key={c} aria-labelledby={`categorie-${c}`} className="flex max-w-3xl flex-col gap-3">
          <h2 id={`categorie-${c}`} className="text-xl">{t(`categories.${c}`)}</h2>
          <ul className="flex flex-col gap-3">
            {modeles
              .filter((m) => m.categorie === c)
              .map((m) => (
                <li key={m.id} className="rounded-md border border-ima-line bg-white p-4">
                  <p className="font-semibold text-ima-navy">
                    {m.titre}
                    {ima && (
                      <span className={`ml-2 rounded-sm border px-2 py-0.5 text-sm ${m.valide ? "border-repere-favorable text-repere-favorable" : "border-repere-vigilance text-repere-vigilance"}`}>
                        {m.valide ? t("validated") : t("toValidate")}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm">{m.description}</p>
                  <p className="mt-1 text-sm text-ima-muted">
                    {ima && `${tl(`country.${m.pays}`)} · `}
                    {t("format", { format: m.format.toUpperCase(), langue: m.langue })}
                    {m.source && (
                      <>
                        {" · "}
                        <a href={m.source.url} target="_blank" rel="noopener noreferrer" className="underline">
                          {t("source", { source: m.source.libelle })}
                        </a>
                      </>
                    )}
                  </p>
                  <p className="mt-3">
                    <a href={`/api/modeles/${m.id}`} className={bouton}>
                      {t("download")}
                    </a>
                  </p>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <p className="max-w-[70ch] text-sm text-ima-muted">{t("logoHelp")}</p>
    </div>
  );
}
