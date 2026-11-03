// Page « Mentions légales » (étape 10), dans les 4 langues. Brouillon de l'agent juridique IMA du 03/11/2026 :
// identité du prestataire (Code de droit économique, livre XII ; informations demandées par le SPF Economie),
// hébergeurs, propriété intellectuelle, IA. À valider par un juriste ; les champs « [À COMPLÉTER] » sont à remplir
// par Michelle avant le lancement.
import type { TexteConfidentialite } from "./textes";

const CONTACT = "info@institutmindsetenaction.com";
const A_COMPLETER = "[À COMPLÉTER]";

export const TEXTES_MENTIONS_LEGALES: Record<"fr" | "nl" | "en" | "pt-BR", TexteConfidentialite> = {
  fr: {
    titre: "Mentions légales",
    aValider: "Version de travail — à valider par un juriste avant le lancement.",
    intro: "PluriPrev – RPS est une application de l'Institut Mindset en Action® pour la prévention des risques psychosociaux au travail.",
    sections: [
      {
        titre: "Éditeur",
        puces: [
          "Institut Mindset en Action®, exploité par Michelle Assunção, indépendante (personne physique)",
          `Adresse d'établissement : ${A_COMPLETER}`,
          `Numéro d'entreprise (BCE) : ${A_COMPLETER}`,
          `Numéro de TVA : ${A_COMPLETER}`,
          `E-mail : ${CONTACT}`,
          "Responsable de la publication : Michelle Assunção",
        ],
      },
      {
        titre: "Hébergement",
        puces: [
          "Application : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (fonctions exécutées dans l'Union européenne)",
          "Base de données : OVH SAS, 2 rue Kellermann, 59100 Roubaix, France (centre de données dans l'Union européenne)",
        ],
      },
      {
        titre: "Intelligence artificielle",
        paragraphes: [
          "Certains brouillons (rapports collectifs, aide à la rédaction) sont préparés avec l'aide d'une IA (Claude, Anthropic). Ils sont toujours relus et validés par une personne formée avant toute utilisation, et marqués comme préparés avec l'aide de l'IA.",
        ],
      },
      {
        titre: "Propriété intellectuelle",
        paragraphes: [
          "Le nom PluriPrev, la marque Institut Mindset en Action®, la méthode MINDSET®, les textes, modèles et le logiciel sont protégés. Toute reproduction sans autorisation écrite est interdite. Les questionnaires scientifiques utilisés (par exemple le COPSOQ) restent la propriété de leurs auteurs et sont utilisés selon leurs conditions.",
          "Les formulaires officiels du SPF Emploi, Travail et Concertation sociale sont repris avec mention de leur source.",
        ],
      },
      {
        titre: "Données personnelles",
        paragraphes: ["La manière dont les données sont traitées est expliquée sur la page « Confidentialité »."],
      },
      {
        titre: "Droit applicable",
        paragraphes: ["Ces mentions sont soumises au droit belge."],
      },
    ],
  },
  nl: {
    titre: "Wettelijke vermeldingen",
    aValider: "Werkversie — vóór de lancering te valideren door een jurist.",
    intro: "PluriPrev – RPS is een toepassing van het Institut Mindset en Action® voor de preventie van psychosociale risico's op het werk.",
    sections: [
      {
        titre: "Uitgever",
        puces: [
          "Institut Mindset en Action®, uitgebaat door Michelle Assunção, zelfstandige (natuurlijke persoon)",
          `Vestigingsadres: ${A_COMPLETER}`,
          `Ondernemingsnummer (KBO): ${A_COMPLETER}`,
          `Btw-nummer: ${A_COMPLETER}`,
          `E-mail: ${CONTACT}`,
          "Verantwoordelijke uitgever: Michelle Assunção",
        ],
      },
      {
        titre: "Hosting",
        puces: [
          "Toepassing: Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, Verenigde Staten (functies uitgevoerd in de Europese Unie)",
          "Databank: OVH SAS, 2 rue Kellermann, 59100 Roubaix, Frankrijk (datacenter in de Europese Unie)",
        ],
      },
      {
        titre: "Artificiële intelligentie",
        paragraphes: [
          "Sommige ontwerpen (collectieve rapporten, schrijfhulp) worden voorbereid met behulp van AI (Claude, Anthropic). Ze worden altijd nagelezen en gevalideerd door een opgeleide persoon vóór elk gebruik, en gemarkeerd als voorbereid met behulp van AI.",
        ],
      },
      {
        titre: "Intellectuele eigendom",
        paragraphes: [
          "De naam PluriPrev, het merk Institut Mindset en Action®, de methode MINDSET®, de teksten, modellen en de software zijn beschermd. Elke reproductie zonder schriftelijke toestemming is verboden. De gebruikte wetenschappelijke vragenlijsten (bijvoorbeeld de COPSOQ) blijven eigendom van hun auteurs en worden gebruikt volgens hun voorwaarden.",
          "De officiële formulieren van de FOD Werkgelegenheid, Arbeid en Sociaal Overleg worden overgenomen met vermelding van hun bron.",
        ],
      },
      {
        titre: "Persoonsgegevens",
        paragraphes: ["Hoe de gegevens worden verwerkt, staat uitgelegd op de pagina « Privacy »."],
      },
      {
        titre: "Toepasselijk recht",
        paragraphes: ["Deze vermeldingen zijn onderworpen aan het Belgisch recht."],
      },
    ],
  },
  en: {
    titre: "Legal notice",
    aValider: "Working version — to be validated by a lawyer before launch.",
    intro: "PluriPrev – RPS is an application of the Institut Mindset en Action® for the prevention of psychosocial risks at work.",
    sections: [
      {
        titre: "Publisher",
        puces: [
          "Institut Mindset en Action®, operated by Michelle Assunção, self-employed (natural person)",
          `Business address: ${A_COMPLETER}`,
          `Company number (Crossroads Bank for Enterprises): ${A_COMPLETER}`,
          `VAT number: ${A_COMPLETER}`,
          `Email: ${CONTACT}`,
          "Publication manager: Michelle Assunção",
        ],
      },
      {
        titre: "Hosting",
        puces: [
          "Application: Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States (functions run in the European Union)",
          "Database: OVH SAS, 2 rue Kellermann, 59100 Roubaix, France (data centre in the European Union)",
        ],
      },
      {
        titre: "Artificial intelligence",
        paragraphes: [
          "Some drafts (collective reports, writing aid) are prepared with the help of AI (Claude, Anthropic). They are always reviewed and validated by a trained person before any use, and marked as prepared with the help of AI.",
        ],
      },
      {
        titre: "Intellectual property",
        paragraphes: [
          "The PluriPrev name, the Institut Mindset en Action® trademark, the MINDSET® method, the texts, templates and software are protected. Any reproduction without written permission is prohibited. The scientific questionnaires used (for example the COPSOQ) remain the property of their authors and are used under their terms.",
          "The official forms of the Federal Public Service Employment, Labour and Social Dialogue are reproduced with their source.",
        ],
      },
      {
        titre: "Personal data",
        paragraphes: ["How data is processed is explained on the « Privacy » page."],
      },
      {
        titre: "Applicable law",
        paragraphes: ["This notice is governed by Belgian law."],
      },
    ],
  },
  "pt-BR": {
    titre: "Informações legais",
    aValider: "Versão de trabalho — a ser validada por um jurista antes do lançamento.",
    intro: "PluriPrev – RPS é um aplicativo do Institut Mindset en Action® para a prevenção dos riscos psicossociais no trabalho.",
    sections: [
      {
        titre: "Editor",
        puces: [
          "Institut Mindset en Action®, explorado por Michelle Assunção, profissional independente (pessoa física) na Bélgica",
          `Endereço do estabelecimento: ${A_COMPLETER}`,
          `Número de empresa (BCE, Bélgica): ${A_COMPLETER}`,
          `Número de IVA: ${A_COMPLETER}`,
          `E-mail: ${CONTACT}`,
          "Responsável pela publicação: Michelle Assunção",
        ],
      },
      {
        titre: "Hospedagem",
        puces: [
          "Aplicativo: Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, Estados Unidos (funções executadas na União Europeia)",
          "Banco de dados: OVH SAS, 2 rue Kellermann, 59100 Roubaix, França (centro de dados na União Europeia)",
        ],
      },
      {
        titre: "Inteligência artificial",
        paragraphes: [
          "Alguns rascunhos (relatórios coletivos, ajuda à redação) são preparados com a ajuda de uma IA (Claude, Anthropic). Eles são sempre revisados e validados por uma pessoa capacitada antes de qualquer uso, e marcados como preparados com a ajuda da IA.",
        ],
      },
      {
        titre: "Propriedade intelectual",
        paragraphes: [
          "O nome PluriPrev, a marca Institut Mindset en Action®, o método MINDSET®, os textos, modelos e o software são protegidos. Qualquer reprodução sem autorização por escrito é proibida. Os questionários científicos utilizados (por exemplo, o COPSOQ) continuam sendo propriedade de seus autores e são usados conforme suas condições.",
          "Os formulários oficiais do SPF Emprego, Trabalho e Concertação Social da Bélgica são reproduzidos com a indicação da fonte.",
        ],
      },
      {
        titre: "Dados pessoais",
        paragraphes: ["A forma como os dados são tratados é explicada na página « Privacidade »."],
      },
      {
        titre: "Lei aplicável",
        paragraphes: ["Estas informações estão sujeitas ao direito belga."],
      },
    ],
  },
};
