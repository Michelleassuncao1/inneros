"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { BoutonEnvoi, Champ, MessageErreur, MessageInfo } from "@/components/Formulaire";
import type { EtatDemandeLien } from "./actions";

export function FormulaireLien({
  action,
}: {
  action: (etat: EtatDemandeLien, formData: FormData) => Promise<EtatDemandeLien>;
}) {
  const t = useTranslations("ReferentLogin");
  const [etat, envoyer] = useActionState(action, {});

  if (etat.envoye) {
    return (
      <div className="mt-8 max-w-md">
        <MessageInfo>{t("sent")}</MessageInfo>
      </div>
    );
  }

  return (
    <form action={envoyer} className="mt-8 flex max-w-md flex-col gap-5">
      {etat.erreur && <MessageErreur>{t("errorEmail")}</MessageErreur>}
      <Champ id="email" name="email" type="email" label={t("email")} autoComplete="email" required />
      <div>
        <BoutonEnvoi libelle={t("submit")} enCours={t("pending")} />
      </div>
    </form>
  );
}
