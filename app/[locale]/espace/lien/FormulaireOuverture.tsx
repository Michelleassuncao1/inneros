"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { BoutonEnvoi, MessageErreur } from "@/components/Formulaire";
import { Link } from "@/i18n/navigation";
import type { EtatLien } from "./actions";

// Le lien n'est utilisé qu'au clic sur le bouton : les antivirus de messagerie
// qui ouvrent les liens automatiquement ne peuvent donc pas le « consommer ».
export function FormulaireOuverture({
  action,
  jeton,
}: {
  action: (etat: EtatLien, formData: FormData) => Promise<EtatLien>;
  jeton: string;
}) {
  const t = useTranslations("MagicLink");
  const [etat, envoyer] = useActionState(action, {});

  if (etat.erreur || !jeton) {
    return (
      <div className="mt-8 flex max-w-md flex-col gap-5">
        <MessageErreur>{t("errorExpired")}</MessageErreur>
        <Link href="/espace/connexion" className="font-semibold text-ima-navy underline">
          {t("newLink")}
        </Link>
      </div>
    );
  }

  return (
    <form action={envoyer} className="mt-8">
      <input type="hidden" name="token" value={jeton} />
      <BoutonEnvoi libelle={t("submit")} enCours={t("pending")} />
    </form>
  );
}
