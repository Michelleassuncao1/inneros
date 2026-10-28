// Page de confidentialité (étape 9), dans les 4 langues. Version de travail : à valider par un juriste et
// dans l'AIPD (rôle de responsable du traitement, hébergeurs, bases légales, durées).
// Les durées viennent des réglages ({reponses}, {secours}, {journal}, {inscriptionsAteliers}, {avisAteliers})
// pour rester toujours exactes.
export type SectionConfidentialite = { titre: string; paragraphes?: string[]; puces?: string[] };
export type TexteConfidentialite = { titre: string; aValider: string; intro: string; sections: SectionConfidentialite[] };

const CONTACT = "info@institutmindsetenaction.com";

export const TEXTES_CONFIDENTIALITE: Record<"fr" | "nl" | "en" | "pt-BR", TexteConfidentialite> = {
  fr: {
    titre: "Confidentialité et protection des données",
    aValider: "Version de travail — à valider par un juriste et dans l'analyse d'impact (AIPD).",
    intro:
      "InnerOS sert à mesurer collectivement le bien-être et les facteurs psychosociaux au travail. Il a été conçu pour que personne, ni votre employeur ni l'Institut Mindset en Action®, ne puisse savoir ce qu'une personne a répondu.",
    sections: [
      {
        titre: "Qui traite les données ?",
        paragraphes: [
          "InnerOS est un outil de l'Institut Mindset en Action® (IMA), utilisé dans le cadre d'une mission confiée par votre employeur. Le rôle exact de chacun (responsable du traitement, sous-traitant) est précisé dans le contrat et dans l'analyse d'impact.",
          `Contact : ${CONTACT}`,
        ],
      },
      {
        titre: "Pourquoi ?",
        paragraphes: [
          "Pour mesurer collectivement les conditions de travail et le bien-être, et trouver ensemble des pistes de prévention. Le questionnaire ne sert jamais à évaluer une personne et ne pose aucun diagnostic.",
        ],
      },
      {
        titre: "Ce qui est enregistré quand vous répondez",
        puces: [
          "le groupe que vous choisissez (par exemple votre service) ;",
          "la date du jour, jamais l'heure ;",
          "vos réponses, sous forme de chiffres (il n'y a aucune case de texte libre) ;",
          "la version des questionnaires utilisés.",
        ],
      },
      {
        titre: "Ce qui n'est jamais enregistré",
        puces: [
          "votre nom, votre adresse e-mail, votre adresse IP, votre appareil ou votre navigateur ;",
          "l'heure de votre réponse ;",
          "un lien entre votre code et vos réponses : le code sert seulement à vérifier qu'il n'est utilisé qu'une fois, et il est supprimé à la fin de l'enquête.",
        ],
      },
      {
        titre: "Qui voit quoi ?",
        puces: [
          "Personne ne peut voir les réponses d'une personne, ni votre employeur ni IMA.",
          "Les résultats sont calculés par groupe d'au moins 10 personnes. En dessous, rien n'est calculé ni affiché, et aucun recoupement ne permet de retrouver un petit groupe.",
          "IMA voit les résultats de groupe et rédige le rapport.",
          "Votre employeur reçoit uniquement le rapport collectif, après sa validation par IMA.",
        ],
      },
      {
        titre: "Usage de l'intelligence artificielle",
        paragraphes: [
          "Le rapport collectif peut être préparé avec l'aide d'une intelligence artificielle (Claude, de la société Anthropic). Elle reçoit uniquement des résultats de groupe (moyennes et effectifs), jamais une réponse individuelle. Elle ne calcule pas les scores et ne prend aucune décision.",
          "Chaque rapport est relu, corrigé et validé par un praticien d'IMA, puis vérifié par votre employeur. Il porte la mention « Analyse préparée avec l'assistance d'une IA et validée par un praticien IMA » (article 50 du règlement européen sur l'intelligence artificielle).",
        ],
      },
      {
        titre: "Combien de temps ?",
        puces: [
          "codes : supprimés à la clôture de l'enquête ;",
          "réponses (anonymes) : supprimées {reponses} mois après l'acceptation du rapport par votre employeur, et au plus tard {secours} mois après la clôture ;",
          "résultats de groupe et rapport : durée du contrat, plus un an ;",
          "journal des actions d'IMA et des référents : {journal} mois.",
        ],
      },
      {
        titre: "Où sont les données ?",
        puces: [
          "base de données : OVHcloud, dans l'Union européenne ;",
          "application : Vercel, avec des fonctions exécutées en Europe ;",
          "e-mails de connexion des référents : Brevo ;",
          "intelligence artificielle : Anthropic, qui ne reçoit que des résultats de groupe.",
        ],
      },
      {
        titre: "Vos droits",
        paragraphes: [
          "Vos réponses ne sont liées ni à votre nom ni à votre code. Personne, pas même IMA, ne peut donc retrouver, corriger ou supprimer les réponses d'une personne en particulier : c'est la garantie de votre anonymat. Vous pouvez passer une question ou arrêter à tout moment, sans conséquence.",
          `Pour toute question : ${CONTACT}. Vous pouvez aussi vous adresser à l'autorité de protection des données de votre pays : en Belgique, l'Autorité de protection des données (APD) ; en France, la CNIL ; au Brésil, l'ANPD ; au Portugal, la CNPD.`,
        ],
      },
      {
        titre: "Référents et praticiens IMA",
        paragraphes: [
          "Pour les personnes qui se connectent (référents des entreprises et praticiens IMA) : nom, adresse e-mail, rôle et journal des actions. Ces données sont conservées pendant le contrat, plus un an ; le journal pendant {journal} mois.",
        ],
      },
      {
        titre: "Ateliers (inscription et avis)",
        paragraphes: [
          "Quand votre employeur propose un atelier (par exemple un quart d'heure bien-être, du yoga guidé ou une formation des managers), un lien ou un QR code permet de s'inscrire puis de donner son avis. Pour ces inscriptions, votre employeur est responsable du traitement et l'Institut Mindset en Action® (InnerOS) est son sous-traitant.",
        ],
        puces: [
          "Inscription : votre nom, votre adresse e-mail professionnelle et votre présence, pour organiser l'atelier, vous envoyer la confirmation et un rappel la veille. Seuls le conseiller en prévention de votre employeur et IMA les voient. Elles sont supprimées {inscriptionsAteliers} jours après l'atelier ; seuls les nombres d'inscrits et de présents restent.",
          "La participation est volontaire. La présence et les avis ne servent jamais à évaluer une personne.",
          "Avis après l'atelier : des réponses à choix et, si vous le souhaitez, un commentaire. L'avis n'est jamais relié à votre inscription ; seule la date du jour est enregistrée, sans heure ni donnée de connexion. Un cookie technique, qui ne contient que l'identifiant de l'atelier, évite de donner deux avis depuis le même appareil.",
          "Les résultats ne sont affichés qu'à partir de 5 avis, pour l'atelier entier. Dans un petit groupe, on peut parfois reconnaître quelqu'un à ce qu'il écrit : ne citez personne et n'indiquez pas de coordonnées. Les avis sont supprimés après {avisAteliers} mois.",
          "Pour vous désinscrire, utilisez le lien reçu par e-mail. Pour toute autre demande sur ces données, adressez-vous à votre employeur ou à IMA.",
        ],
      },
    ],
  },
  nl: {
    titre: "Privacy en gegevensbescherming",
    aValider: "Werkversie — te valideren door een jurist en in de gegevensbeschermingseffectbeoordeling (GEB).",
    intro:
      "InnerOS dient om het welzijn en de psychosociale factoren op het werk collectief te meten. Het is zo ontworpen dat niemand, noch uw werkgever noch het Institut Mindset en Action®, kan weten wat een persoon heeft geantwoord.",
    sections: [
      {
        titre: "Wie verwerkt de gegevens?",
        paragraphes: [
          "InnerOS is een instrument van het Institut Mindset en Action® (IMA), gebruikt in het kader van een opdracht van uw werkgever. De precieze rol van elk (verwerkingsverantwoordelijke, verwerker) staat in het contract en in de effectbeoordeling.",
          `Contact: ${CONTACT}`,
        ],
      },
      {
        titre: "Waarom?",
        paragraphes: [
          "Om de arbeidsomstandigheden en het welzijn collectief te meten en samen preventiesporen te vinden. De vragenlijst dient nooit om een persoon te beoordelen en stelt geen enkele diagnose.",
        ],
      },
      {
        titre: "Wat wordt er geregistreerd wanneer u antwoordt",
        puces: [
          "de groep die u kiest (bijvoorbeeld uw dienst);",
          "de datum van de dag, nooit het tijdstip;",
          "uw antwoorden, in de vorm van cijfers (er is geen enkel vrij tekstvak);",
          "de versie van de gebruikte vragenlijsten.",
        ],
      },
      {
        titre: "Wat nooit wordt geregistreerd",
        puces: [
          "uw naam, e-mailadres, IP-adres, toestel of browser;",
          "het tijdstip van uw antwoord;",
          "een verband tussen uw code en uw antwoorden: de code dient alleen om na te gaan dat hij maar één keer wordt gebruikt, en wordt aan het einde van de bevraging verwijderd.",
        ],
      },
      {
        titre: "Wie ziet wat?",
        puces: [
          "Niemand kan de antwoorden van een persoon zien, noch uw werkgever noch IMA.",
          "De resultaten worden berekend per groep van minstens 10 personen. Daaronder wordt niets berekend of getoond, en geen enkele vergelijking maakt het mogelijk een kleine groep te achterhalen.",
          "IMA ziet de groepsresultaten en schrijft het rapport.",
          "Uw werkgever ontvangt alleen het collectieve rapport, na validatie door IMA.",
        ],
      },
      {
        titre: "Gebruik van artificiële intelligentie",
        paragraphes: [
          "Het collectieve rapport kan worden voorbereid met de hulp van artificiële intelligentie (Claude, van het bedrijf Anthropic). Zij ontvangt alleen groepsresultaten (gemiddelden en aantallen), nooit een individueel antwoord. Zij berekent de scores niet en neemt geen enkele beslissing.",
          "Elk rapport wordt nagelezen, verbeterd en gevalideerd door een IMA-practitioner en daarna gecontroleerd door uw werkgever. Het vermeldt « Analyse voorbereid met de hulp van AI en gevalideerd door een IMA-practitioner » (artikel 50 van de Europese verordening over artificiële intelligentie).",
        ],
      },
      {
        titre: "Hoe lang?",
        puces: [
          "codes: verwijderd bij de afsluiting van de bevraging;",
          "antwoorden (anoniem): verwijderd {reponses} maanden na de aanvaarding van het rapport door uw werkgever, en uiterlijk {secours} maanden na de afsluiting;",
          "groepsresultaten en rapport: duur van het contract, plus één jaar;",
          "logboek van de acties van IMA en de referentiepersonen: {journal} maanden.",
        ],
      },
      {
        titre: "Waar staan de gegevens?",
        puces: [
          "databank: OVHcloud, in de Europese Unie;",
          "toepassing: Vercel, met functies die in Europa worden uitgevoerd;",
          "aanmeldingsmails van de referentiepersonen: Brevo;",
          "artificiële intelligentie: Anthropic, dat alleen groepsresultaten ontvangt.",
        ],
      },
      {
        titre: "Uw rechten",
        paragraphes: [
          "Uw antwoorden zijn niet gekoppeld aan uw naam of uw code. Niemand, zelfs IMA niet, kan dus de antwoorden van een bepaalde persoon terugvinden, verbeteren of verwijderen: dat is de garantie van uw anonimiteit. U kunt op elk moment een vraag overslaan of stoppen, zonder gevolgen.",
          `Voor vragen: ${CONTACT}. U kunt zich ook wenden tot de gegevensbeschermingsautoriteit van uw land: in België de Gegevensbeschermingsautoriteit (GBA); in Frankrijk de CNIL; in Brazilië de ANPD; in Portugal de CNPD.`,
        ],
      },
      {
        titre: "Referentiepersonen en IMA-practitioners",
        paragraphes: [
          "Voor de personen die zich aanmelden (referentiepersonen van de ondernemingen en IMA-practitioners): naam, e-mailadres, rol en logboek van de acties. Deze gegevens worden bewaard tijdens het contract, plus één jaar; het logboek gedurende {journal} maanden.",
        ],
      },
      {
        titre: "Workshops (inschrijving en feedback)",
        paragraphes: [
          "Wanneer uw werkgever een workshop aanbiedt (bijvoorbeeld een welzijnskwartier, begeleide yoga of een opleiding voor leidinggevenden), kunt u zich via een link of QR-code inschrijven en daarna feedback geven. Voor deze inschrijvingen is uw werkgever verwerkingsverantwoordelijke en het Institut Mindset en Action® (InnerOS) zijn verwerker.",
        ],
        puces: [
          "Inschrijving: uw naam, uw professioneel e-mailadres en uw aanwezigheid, om de workshop te organiseren en u de bevestiging en een herinnering de dag ervoor te sturen. Alleen de preventieadviseur van uw werkgever en IMA zien ze. Ze worden {inscriptionsAteliers} dagen na de workshop verwijderd; alleen het aantal ingeschrevenen en aanwezigen blijft.",
          "Deelnemen is vrijwillig. Aanwezigheid en feedback worden nooit gebruikt om iemand te beoordelen.",
          "Feedback na de workshop: antwoorden op meerkeuzevragen en, als u wilt, een opmerking. De feedback wordt nooit aan uw inschrijving gekoppeld; alleen de datum wordt geregistreerd, zonder uur of verbindingsgegevens. Een technische cookie, die alleen het nummer van de workshop bevat, voorkomt dat vanaf hetzelfde toestel twee keer feedback wordt gegeven.",
          "De resultaten worden pas getoond vanaf 5 antwoorden, voor de hele workshop. In een kleine groep kan men iemand soms herkennen aan wat hij of zij schrijft: noem geen namen en geef geen contactgegevens. De feedback wordt na {avisAteliers} maanden verwijderd.",
          "Om u uit te schrijven, gebruikt u de link uit de e-mail. Voor andere vragen over deze gegevens kunt u terecht bij uw werkgever of bij IMA.",
        ],
      },
    ],
  },
  en: {
    titre: "Privacy and data protection",
    aValider: "Working version — to be validated by a lawyer and in the data protection impact assessment (DPIA).",
    intro:
      "InnerOS is used to measure well-being and psychosocial factors at work collectively. It is designed so that nobody, neither your employer nor the Institut Mindset en Action®, can know what any one person answered.",
    sections: [
      {
        titre: "Who processes the data?",
        paragraphes: [
          "InnerOS is a tool of the Institut Mindset en Action® (IMA), used for an assignment given by your employer. The exact role of each party (controller, processor) is set out in the contract and in the impact assessment.",
          `Contact: ${CONTACT}`,
        ],
      },
      {
        titre: "Why?",
        paragraphes: [
          "To measure working conditions and well-being collectively and find prevention measures together. The questionnaire is never used to assess a person and makes no diagnosis.",
        ],
      },
      {
        titre: "What is recorded when you answer",
        puces: [
          "the group you choose (for example your department);",
          "the date, never the time;",
          "your answers, as numbers (there is no free-text box);",
          "the version of the questionnaires used.",
        ],
      },
      {
        titre: "What is never recorded",
        puces: [
          "your name, email address, IP address, device or browser;",
          "the time of your answer;",
          "any link between your code and your answers: the code is only used to check that it is used once, and it is deleted at the end of the survey.",
        ],
      },
      {
        titre: "Who sees what?",
        puces: [
          "Nobody can see an individual's answers, neither your employer nor IMA.",
          "Results are calculated for groups of at least 10 people. Below that, nothing is calculated or shown, and no cross-checking can reveal a small group.",
          "IMA sees group results and writes the report.",
          "Your employer only receives the collective report, after IMA has validated it.",
        ],
      },
      {
        titre: "Use of artificial intelligence",
        paragraphes: [
          "The collective report may be prepared with the help of artificial intelligence (Claude, by the company Anthropic). It only receives group results (averages and numbers of people), never an individual answer. It does not calculate the scores and makes no decision.",
          "Every report is reviewed, corrected and validated by an IMA practitioner, then checked by your employer. It states “Analysis prepared with the assistance of AI and validated by an IMA practitioner” (Article 50 of the EU Artificial Intelligence Act).",
        ],
      },
      {
        titre: "How long?",
        puces: [
          "codes: deleted when the survey is closed;",
          "answers (anonymous): deleted {reponses} months after your employer accepts the report, and at the latest {secours} months after closure;",
          "group results and report: length of the contract, plus one year;",
          "log of actions by IMA and referents: {journal} months.",
        ],
      },
      {
        titre: "Where is the data?",
        puces: [
          "database: OVHcloud, in the European Union;",
          "application: Vercel, with functions run in Europe;",
          "sign-in emails for referents: Brevo;",
          "artificial intelligence: Anthropic, which only receives group results.",
        ],
      },
      {
        titre: "Your rights",
        paragraphes: [
          "Your answers are linked neither to your name nor to your code. So nobody, not even IMA, can find, correct or delete the answers of a particular person: this is what guarantees your anonymity. You can skip a question or stop at any time, without consequence.",
          `For any question: ${CONTACT}. You can also contact the data protection authority in your country: in Belgium, the Data Protection Authority (APD/GBA); in France, the CNIL; in Brazil, the ANPD; in Portugal, the CNPD.`,
        ],
      },
      {
        titre: "Referents and IMA practitioners",
        paragraphes: [
          "For people who sign in (company referents and IMA practitioners): name, email address, role and log of actions. This data is kept for the length of the contract, plus one year; the log for {journal} months.",
        ],
      },
      {
        titre: "Workshops (registration and feedback)",
        paragraphes: [
          "When your employer offers a workshop (for example a well-being quarter hour, guided yoga or manager training), a link or QR code lets you sign up and then give feedback. For these registrations, your employer is the controller and Institut Mindset en Action® (InnerOS) is its processor.",
        ],
        puces: [
          "Registration: your name, your work email address and your attendance, to organise the workshop and send you the confirmation and a reminder the day before. Only your employer's prevention adviser and IMA can see them. They are deleted {inscriptionsAteliers} days after the workshop; only the numbers of registered and present people remain.",
          "Taking part is voluntary. Attendance and feedback are never used to assess anyone.",
          "Feedback after the workshop: multiple-choice answers and, if you wish, a comment. Feedback is never linked to your registration; only the date is recorded, with no time or connection data. A technical cookie, containing only the workshop identifier, prevents giving feedback twice from the same device.",
          "Results are shown only from 5 responses, for the whole workshop. In a small group, people can sometimes be recognised by what they write: do not name anyone or give contact details. Feedback is deleted after {avisAteliers} months.",
          "To cancel your registration, use the link in the email. For any other request about this data, contact your employer or IMA.",
        ],
      },
    ],
  },
  "pt-BR": {
    titre: "Privacidade e proteção de dados",
    aValider: "Versão de trabalho — a validar por um jurista e no relatório de impacto à proteção de dados.",
    intro:
      "O InnerOS serve para medir coletivamente o bem-estar e os fatores psicossociais no trabalho. Ele foi concebido para que ninguém, nem o seu empregador nem o Institut Mindset en Action®, possa saber o que uma pessoa respondeu.",
    sections: [
      {
        titre: "Quem trata os dados?",
        paragraphes: [
          "O InnerOS é uma ferramenta do Institut Mindset en Action® (IMA), utilizada no âmbito de uma missão confiada pelo seu empregador. O papel exato de cada um (controlador, operador) está definido no contrato e no relatório de impacto.",
          `Contato: ${CONTACT}`,
        ],
      },
      {
        titre: "Por quê?",
        paragraphes: [
          "Para medir coletivamente as condições de trabalho e o bem-estar e encontrar juntos caminhos de prevenção. O questionário nunca serve para avaliar uma pessoa e não faz nenhum diagnóstico.",
        ],
      },
      {
        titre: "O que é registrado quando você responde",
        puces: [
          "o grupo que você escolhe (por exemplo, o seu setor);",
          "a data do dia, nunca o horário;",
          "as suas respostas, em forma de números (não há nenhum campo de texto livre);",
          "a versão dos questionários utilizados.",
        ],
      },
      {
        titre: "O que nunca é registrado",
        puces: [
          "o seu nome, e-mail, endereço IP, aparelho ou navegador;",
          "o horário da sua resposta;",
          "qualquer vínculo entre o seu código e as suas respostas: o código serve apenas para verificar que é usado uma única vez e é excluído ao final da pesquisa.",
        ],
      },
      {
        titre: "Quem vê o quê?",
        puces: [
          "Ninguém pode ver as respostas de uma pessoa, nem o seu empregador nem a IMA.",
          "Os resultados são calculados por grupos de pelo menos 10 pessoas. Abaixo disso, nada é calculado nem exibido, e nenhum cruzamento permite identificar um grupo pequeno.",
          "A IMA vê os resultados por grupo e redige o relatório.",
          "O seu empregador recebe apenas o relatório coletivo, após a validação pela IMA.",
        ],
      },
      {
        titre: "Uso de inteligência artificial",
        paragraphes: [
          "O relatório coletivo pode ser preparado com a ajuda de uma inteligência artificial (Claude, da empresa Anthropic). Ela recebe apenas resultados por grupo (médias e efetivos), nunca uma resposta individual. Ela não calcula os escores e não toma nenhuma decisão.",
          "Cada relatório é revisado, corrigido e validado por um profissional da IMA e, depois, verificado pelo seu empregador. Ele traz a menção « Análise preparada com a assistência de uma IA e validada por um profissional da IMA » (artigo 50 do regulamento europeu sobre inteligência artificial).",
        ],
      },
      {
        titre: "Por quanto tempo?",
        puces: [
          "códigos: excluídos no encerramento da pesquisa;",
          "respostas (anônimas): excluídas {reponses} meses após a aceitação do relatório pelo seu empregador e, no máximo, {secours} meses após o encerramento;",
          "resultados por grupo e relatório: duração do contrato, mais um ano;",
          "registro das ações da IMA e dos referentes: {journal} meses.",
        ],
      },
      {
        titre: "Onde estão os dados?",
        puces: [
          "banco de dados: OVHcloud, na União Europeia;",
          "aplicação: Vercel, com funções executadas na Europa;",
          "e-mails de acesso dos referentes: Brevo;",
          "inteligência artificial: Anthropic, que recebe apenas resultados por grupo.",
        ],
      },
      {
        titre: "Os seus direitos",
        paragraphes: [
          "As suas respostas não estão vinculadas nem ao seu nome nem ao seu código. Portanto, ninguém, nem mesmo a IMA, pode encontrar, corrigir ou excluir as respostas de uma pessoa específica: essa é a garantia do seu anonimato. Você pode pular uma pergunta ou parar a qualquer momento, sem consequências.",
          `Para qualquer dúvida: ${CONTACT}. Você também pode se dirigir à autoridade de proteção de dados do seu país: no Brasil, a ANPD (LGPD); na Bélgica, a APD; na França, a CNIL; em Portugal, a CNPD.`,
        ],
      },
      {
        titre: "Referentes e profissionais da IMA",
        paragraphes: [
          "Para as pessoas que acessam a plataforma (referentes das empresas e profissionais da IMA): nome, e-mail, função e registro das ações. Esses dados são conservados durante o contrato, mais um ano; o registro, durante {journal} meses.",
        ],
      },
      {
        titre: "Oficinas (inscrição e avaliação)",
        paragraphes: [
          "Quando seu empregador oferece uma oficina (por exemplo, quinze minutos de bem-estar, yoga guiado ou formação de gestores), um link ou QR code permite se inscrever e depois dar sua avaliação. Para essas inscrições, seu empregador é o controlador e o Institut Mindset en Action® (InnerOS) é seu operador.",
        ],
        puces: [
          "Inscrição: seu nome, seu e-mail profissional e sua presença, para organizar a oficina e enviar a confirmação e um lembrete na véspera. Apenas o responsável pela prevenção do seu empregador e a IMA os veem. Eles são apagados {inscriptionsAteliers} dias após a oficina; ficam apenas os números de inscritos e de presentes.",
          "A participação é voluntária. A presença e as avaliações nunca servem para avaliar uma pessoa.",
          "Avaliação após a oficina: respostas de múltipla escolha e, se quiser, um comentário. A avaliação nunca é vinculada à sua inscrição; só a data é registrada, sem horário nem dado de conexão. Um cookie técnico, que contém apenas o identificador da oficina, evita dar duas avaliações no mesmo aparelho.",
          "Os resultados só aparecem a partir de 5 avaliações, para a oficina inteira. Em um grupo pequeno, às vezes é possível reconhecer alguém pelo que escreve: não cite ninguém e não informe contatos. As avaliações são apagadas após {avisAteliers} meses.",
          "Para cancelar sua inscrição, use o link recebido por e-mail. Para qualquer outro pedido sobre esses dados, fale com seu empregador ou com a IMA.",
        ],
      },
    ],
  },
};
