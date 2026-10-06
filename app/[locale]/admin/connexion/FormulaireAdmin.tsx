"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { BoutonEnvoi, Champ, MessageErreur } from "@/components/Formulaire";
import type { EtatConnexionAdmin } from "./actions";

export function FormulaireAdmin({
  action,
}: {
  action: (etat: EtatConnexionAdmin, formData: FormData) => Promise<EtatConnexionAdmin>;
}) {
  const t = useTranslations("AdminLogin");
  const [etat, envoyer] = useActionState(action, {});

  return (
    <form action={envoyer} className="mt-8 flex max-w-md flex-col gap-5">
      {etat.erreur && (
        <MessageErreur>{t(etat.erreur === "bloque" ? "errorLocked" : "errorInvalid")}</MessageErreur>
      )}
      <Champ id="email" name="email" type="email" label={t("email")} autoComplete="username" required />
      <Champ
        id="password"
        name="password"
        type="password"
        label={t("password")}
        autoComplete="current-password"
        required
      />
      <Champ
        id="code"
        name="code"
        label={t("code")}
        aide={t("codeHelp")}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
      />
      <div>
        <BoutonEnvoi libelle={t("submit")} enCours={t("pending")} />
      </div>
    </form>
  );
}
