// Kit prêt à diffuser d'une campagne de sensibilisation (module B2) : textes à copier, affiche et fiche
// d'animation en PDF, avec les personnes de soutien de l'entreprise et les numéros d'aide du pays.
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { kitDeCampagne, RessourcesAide } from "@/lib/sensibilisation/calendrier";
import { BoutonCopier } from "./BoutonCopier";

type DonneesKit = NonNullable<Awaited<ReturnType<typeof kitDeCampagne>>>;

// Bloc d'aide ajouté aux textes copiés
export function texteAide(aide: RessourcesAide, titre: string) {
  const lignes = [
    ...aide.contacts.map((c) => `${c.role}${c.nom ? ` — ${c.nom}` : ""}${[c.telephone, c.email].filter(Boolean).length ? ` : ${[c.telephone, c.email].filter(Boolean).join(" · ")}` : ""}`),
    ...aide.aides.map((a) => `${a.numero} — ${a.libelle}`),
  ];
  return lignes.length ? `\n\n${titre}\n${lignes.join("\n")}` : "";
}

export async function KitCampagne({ donnees, base }: { donnees: DonneesKit; base: string }) {
  const t = await getTranslations("Calendrier");
  const l = await getTranslations("Libelles");
  const { kit, aide, langue, disponibles, campagne } = donnees;
  const aideTexte = texteAide(aide, t("helpTitle"));
  const copier = { libelle: t("copy"), copie: t("copied") };
  const bloc = "rounded-md border border-ima-line bg-white p-4";
  const bouton = "inline-block rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {disponibles.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label={t("kitLanguage")}>
          {disponibles.map((lg) => (
            <Link
              key={lg}
              href={`${base}?lang=${lg}`}
              aria-current={lg === langue ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${lg === langue ? "bg-ima-navy text-white" : "border border-ima-line text-ima-navy"}`}
            >
              {l(`locale.${lg}`)}
            </Link>
          ))}
        </nav>
      )}
      <p className="text-ima-muted">{kit.objectif}</p>

      <p className="flex flex-wrap gap-3">
        <a href={`/api/sensibilisation/${campagne.id}/affiche?lang=${langue}`} className={bouton}>{t("downloadPoster")}</a>
        <a href={`/api/sensibilisation/${campagne.id}/fiche?lang=${langue}`} className={bouton}>{t("downloadSheet")}</a>
      </p>

      <section className={bloc}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-lg">{t("article")}</h3>
          <BoutonCopier texte={`${kit.titre}\n\n${kit.article}${aideTexte}`} {...copier} />
        </div>
        <p className="whitespace-pre-line">{kit.article}</p>
      </section>

      <section className={bloc}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-lg">{t("shortMessage")}</h3>
          <BoutonCopier texte={`${kit.message_court}${aideTexte}`} {...copier} />
        </div>
        <p className="whitespace-pre-line">{kit.message_court}</p>
      </section>

      <section className={bloc}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-lg">{t("managersEmail")}</h3>
          <BoutonCopier texte={`${kit.email_managers.objet}\n\n${kit.email_managers.texte}${aideTexte}`} {...copier} />
        </div>
        <p className="font-semibold">{kit.email_managers.objet}</p>
        <p className="mt-2 whitespace-pre-line">{kit.email_managers.texte}</p>
      </section>

      <section className={bloc}>
        <h3 className="mb-2 text-lg">{t("teamQuestions")}</h3>
        <ul className="list-disc space-y-1 pl-5">
          {kit.questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </section>

      <section className={bloc}>
        <h3 className="mb-2 text-lg">{t("ficheTitle")}</h3>
        <p className="mb-2 text-sm text-ima-muted">{t("ficheMeta", { minutes: kit.fiche_animation.duree_minutes })}</p>
        <ol className="list-decimal space-y-1 pl-5">
          {kit.fiche_animation.deroule.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-4">
        <h3 className="mb-2 text-lg">{t("helpTitle")}</h3>
        {aide.contacts.length === 0 && <p className="mb-2 text-sm text-repere-prioritaire">{t("noContacts")}</p>}
        <ul className="space-y-1">
          {aide.contacts.map((c, i) => (
            <li key={i}>
              <span className="font-semibold">{c.role}</span>
              {c.nom ? ` — ${c.nom}` : ""}
              {[c.telephone, c.email].filter(Boolean).length ? ` : ${[c.telephone, c.email].filter(Boolean).join(" · ")}` : ""}
            </li>
          ))}
          {aide.aides.map((a) => (
            <li key={a.numero}>
              <span className="font-semibold">{a.numero}</span> — {a.libelle}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
