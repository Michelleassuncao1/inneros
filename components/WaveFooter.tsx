import { useTranslations } from "next-intl";

// Signature visuelle IMA : la vague bleu nuit soulignée d'un filet or (charte, section 3).
// Une seule signature par écran.
export function WaveFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="mt-auto">
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="block h-16 w-full sm:h-24"
      >
        <path
          d="M0,64 C240,8 480,8 720,48 C960,88 1200,104 1440,56 L1440,120 L0,120 Z"
          className="fill-ima-navy-deep"
        />
        <path
          d="M0,64 C240,8 480,8 720,48 C960,88 1200,104 1440,56"
          fill="none"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          className="stroke-ima-gold"
        />
      </svg>
      <div className="bg-ima-navy-deep px-4 pb-8 pt-2 text-center text-sm text-ima-paper/80">
        <p className="mb-1 font-semibold tracking-widest text-ima-gold">
          {t("values")}
        </p>
        <p>{t("copyright")}</p>
      </div>
    </footer>
  );
}
