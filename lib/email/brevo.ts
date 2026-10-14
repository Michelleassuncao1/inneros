// Envoi d'e-mails transactionnels par l'API Brevo (sans module supplémentaire).
// En développement, sans BREVO_API_KEY, ou pour une adresse de test (.invalid, .test…), le message est affiché
// dans le terminal au lieu d'être envoyé.

export type Email = {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
};

// Domaines réservés aux tests (RFC 2606 / 6761) : jamais d'envoi réel, même avec une clé Brevo
const DOMAINE_DE_TEST = /\.(invalid|test|example|localhost)$/i;

export async function envoyerEmail(email: Email) {
  const cle = process.env.BREVO_API_KEY;
  const expediteur = process.env.EMAIL_FROM;
  const adresseDeTest = DOMAINE_DE_TEST.test(email.to.email.split("@")[1] ?? "");

  if (!cle || !expediteur || adresseDeTest) {
    if (!adresseDeTest && process.env.NODE_ENV === "production") {
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
