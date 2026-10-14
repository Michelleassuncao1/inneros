// Modèle commun des e-mails InnerOS, aux couleurs IMA (version HTML et version texte).
import type { Email } from "./brevo";

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function emailIMA(
  locale: string,
  destinataire: { email: string; name: string },
  contenu: { sujet: string; salutation: string; paragraphes: string[]; bouton: string; lien: string; mention?: string },
): Email {
  const html = `<!doctype html>
<html lang="${locale}"><body style="margin:0;background:#FAF8F3;font-family:Arial,sans-serif;color:#1C1C1A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F3;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-top:4px solid #08275A">
<tr><td style="padding:28px 28px 8px">
<p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8A651F;font-weight:bold">Institut Mindset en Action®</p>
<h1 style="margin:12px 0 0;font-family:Georgia,serif;color:#08275A;font-size:24px">InnerOS</h1>
<div style="width:56px;height:2px;background:#C7952C;margin:12px 0 20px"></div>
<p style="margin:0 0 12px;line-height:1.5">${echapper(contenu.salutation)}</p>
${contenu.paragraphes.map((p) => `<p style="margin:0 0 12px;line-height:1.5">${echapper(p)}</p>`).join("\n")}
<p style="margin:12px 0 24px"><a href="${contenu.lien}" style="display:inline-block;background:#08275A;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px">${echapper(contenu.bouton)}</a></p>
${contenu.mention ? `<p style="margin:0 0 24px;line-height:1.5;color:#5A5A5A;font-size:14px">${echapper(contenu.mention)}</p>` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  const text = [contenu.salutation, "", ...contenu.paragraphes, "", `${contenu.bouton} : ${contenu.lien}`, contenu.mention ? `\n${contenu.mention}` : ""].join("\n");
  return { to: destinataire, subject: contenu.sujet, html, text };
}
