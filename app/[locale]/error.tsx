"use client";

// Page d'erreur IMA (étape 10) : aucune information technique pour le visiteur ; l'erreur est signalée
// à l'onglet « Erreurs » de l'espace IMA, sans donnée personnelle (lib/erreurs/signaler.ts).
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { signalerErreur } from "@/lib/erreurs/signaler";

export default function PageErreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("PageErreur");
  useEffect(() => signalerErreur(error), [error]);

  return (
    <main id="contenu" className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="mt-4 max-w-[60ch]">{t("text")}</p>
      <div className="mt-8 flex flex-wrap gap-4">
        <button type="button" onClick={reset} className="rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep">
          {t("retry")}
        </button>
        <Link href="/" className="rounded-md border border-ima-navy px-5 py-2.5 font-semibold text-ima-navy hover:bg-ima-cream">
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
