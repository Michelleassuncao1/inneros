// E-mail du lien de connexion des référents, aux couleurs IMA, en fr ou pt-BR.
import { getTranslations } from "next-intl/server";
import type { Email } from "./brevo";

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function emailLienMagique(
  locale: string,
  destinataire: { email: string; name: string },
  jeton: string,
): Promise<Email> {
  const t = await getTranslations({ locale, namespace: "Email" });
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const lien = `${base}/${locale}/espace/lien?token=${encodeURIComponent(jeton)}`;

  const html = `<!doctype html>
<html lang="${locale}"><body style="margin:0;background:#FAF8F3;font-family:Arial,sans-serif;color:#1C1C1A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F3;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-top:4px solid #08275A">
<tr><td style="padding:28px 28px 8px">
<p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8A651F;font-weight:bold">Institut Mindset en Action®</p>
<h1 style="margin:12px 0 0;font-family:Georgia,serif;color:#08275A;font-size:24px">InnerOS</h1>
<div style="width:56px;height:2px;background:#C7952C;margin:12px 0 20px"></div>
<p style="margin:0 0 12px;line-height:1.5">${echapper(t("greeting", { name: destinataire.name }))}</p>
<p style="margin:0 0 24px;line-height:1.5">${echapper(t("body"))}</p>
<p style="margin:0 0 24px"><a href="${lien}" style="display:inline-block;background:#08275A;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px">${echapper(t("button"))}</a></p>
<p style="margin:0 0 24px;line-height:1.5;color:#5A5A5A;font-size:14px">${echapper(t("ignore"))}</p>
</td></tr>
<tr><td style="background:#051A3F;border-top:3px solid #C7952C;padding:16px 28px;color:#C7952C;font-size:13px;font-weight:bold">${echapper(t("signature"))}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    t("greeting", { name: destinataire.name }),
    "",
    t("body"),
    "",
    lien,
    "",
    t("ignore"),
    "",
    t("signature"),
  ].join("\n");

  return { to: destinataire, subject: t("subject"), html, text };
}
