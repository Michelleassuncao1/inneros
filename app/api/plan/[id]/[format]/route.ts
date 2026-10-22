// Téléchargements du plan de prévention (module A3, partie 2) : PDF, Excel et fichier d'échange PluriPrev.
// - IMA : à tout moment (un brouillon porte la mention « aperçu ») ;
// - référent : seulement le plan validé qu'il peut voir (conseiller en prévention ou signataire) ;
// - fichier PluriPrev : IMA et le conseiller en prévention seulement.
// Chaque téléchargement est journalisé.
import { z } from "zod";
import { journaliser } from "@/lib/audit";
import { adminConnecte, referentConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { pdfPlan } from "@/lib/pdf/plan";
import { excelPlan } from "@/lib/plan/excel";
import { construireEchange, donneesPlan } from "@/lib/plan/export";
import { planPourReferentSuivi } from "@/lib/plan/suivi";

const FORMATS = ["pdf", "excel", "pluriprev"] as const;
const LANGUES = ["fr", "nl", "en", "pt-BR"] as const;

export async function GET(requete: Request, { params }: RouteContext<"/api/plan/[id]/[format]">) {
  const { id, format: brut } = await params;
  const format = z.enum(FORMATS).safeParse(brut);
  if (!z.string().uuid().safeParse(id).success || !format.success) return new Response(null, { status: 404 });
  const db = getDb();

  const admin = await adminConnecte();
  const referent = admin ? null : await referentConnecte();
  if (!admin && !referent) return new Response(null, { status: 401 });
  if (referent) {
    const acces = await planPourReferentSuivi(db, referent);
    if (!acces || acces.plan.id !== id) return new Response(null, { status: 404 });
    if (format.data === "pluriprev" && !referent.preventionAdvisor) return new Response(null, { status: 404 });
  }

  const d = await donneesPlan(db, id);
  if (!d) return new Response(null, { status: 404 });
  const lg = z.enum(LANGUES).safeParse(new URL(requete.url).searchParams.get("lang"));
  const langue = lg.success ? lg.data : d.plan.language;
  const nom = `plan-prevention-${d.org.internalCode}-${d.plan.startYear}`;

  let corps: Buffer;
  let type: string;
  let fichier: string;
  if (format.data === "pdf") {
    corps = await pdfPlan(d, langue);
    type = "application/pdf";
    fichier = `${nom}.pdf`;
  } else if (format.data === "excel") {
    corps = await excelPlan(d, langue);
    type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    fichier = `${nom}.xlsx`;
  } else {
    if (d.plan.status !== "validated") return new Response(null, { status: 404 });
    corps = Buffer.from(JSON.stringify(construireEchange(d), null, 2));
    type = "application/json; charset=utf-8";
    fichier = `${nom}.inneros.json`;
  }
  await journaliser(db, {
    actorUserId: (admin ?? referent)!.id,
    action: "plan_downloaded",
    targetType: "organization",
    targetId: d.plan.organizationId,
    details: { format: format.data },
  });
  return new Response(new Uint8Array(corps), {
    headers: { "content-type": type, "content-disposition": `attachment; filename="${fichier}"`, "cache-control": "no-store" },
  });
}
