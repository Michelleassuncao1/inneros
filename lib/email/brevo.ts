// Envoi d'e-mails transactionnels par l'API Brevo (sans module supplémentaire).
// En développement, sans BREVO_API_KEY, le message est affiché dans le terminal au lieu d'être envoyé.

export type Email = {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
};

export async function envoyerEmail(email: Email) {
  const cle = process.env.BREVO_API_KEY;
  const expediteur = process.env.EMAIL_FROM;

  if (!cle || !expediteur) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BREVO_API_KEY et EMAIL_FROM sont obligatoires en production");
    }
    console.info(
      `\n[InnerOS — e-mail non envoyé (mode développement)]\nÀ : ${email.to.email}\nObjet : ${email.subject}\n\n${email.text}\n`,
    );
    return;
  }

  const reponse = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": cle, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: expediteur, name: "Institut Mindset en Action" },
      to: [email.to],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
    }),
  });

  if (!reponse.ok) {
    // Le détail de Brevo est utile au diagnostic ; il ne contient pas la clé
    throw new Error(`Envoi Brevo refusé (${reponse.status}) : ${await reponse.text()}`);
  }
}
