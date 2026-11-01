"""Images d'en-tête des modèles Word d'IMA (module D1) : cadre « logo de l'entreprise » et signature IMA.

Usage (Python 3.12 avec Pillow, depuis la racine du projet) :
    python -I scripts/modeles/images_entete.py

Les images sont écrites dans data/modeles/images/. Leurs proportions reprennent celles des logos des
formulaires officiels qu'elles remplacent, pour ne pas changer la mise en page.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RACINE = Path(__file__).resolve().parents[2]
POLICES = RACINE / "node_modules/@fontsource/figtree/files"
SORTIE = RACINE / "data/modeles/images"

NAVY = "#08275A"
GOLD = "#C7952C"
GOLD_TEXT = "#8A651F"
MUTED = "#5A5A5A"


def police(graisse: int, taille: int):
    return ImageFont.truetype(str(POLICES / f"figtree-latin-{graisse}-normal.woff"), taille)


TEXTES = {
    "fr": {
        "logo": "Logo de votre entreprise",
        "aide": ("Révision › Restreindre la modification ›", "Désactiver la protection, puis remplacez ce cadre"),
        "mis": "Modèle mis à disposition par IMA",
        "officiel": ("Formulaire officiel du SPF Emploi, Travail et Concertation sociale", "contenu inchangé · source : emploi.belgique.be"),
    },
    "nl": {
        "logo": "Logo van uw onderneming",
        "aide": ("Controleren › Bewerking beperken ›", "Beveiliging stoppen en dit kader vervangen"),
        "mis": "Model ter beschikking gesteld door IMA",
        "officiel": ("Officieel formulier van de FOD Werkgelegenheid, Arbeid en Sociaal Overleg", "inhoud ongewijzigd · bron: werk.belgie.be"),
    },
}


def cadre_logo(langue: str):
    # 945 × 249 dans le formulaire d'origine, dessiné en double résolution
    largeur, hauteur = 1890, 498
    img = Image.new("RGB", (largeur, hauteur), "white")
    d = ImageDraw.Draw(img)
    cadre = int(largeur * 0.62)
    for x in range(10, cadre, 40):  # pointillés
        d.line([(x, 10), (min(x + 24, cadre), 10)], fill="#B8B0A0", width=6)
        d.line([(x, hauteur - 10), (min(x + 24, cadre), hauteur - 10)], fill="#B8B0A0", width=6)
    for y in range(10, hauteur - 10, 40):
        d.line([(10, y), (10, min(y + 24, hauteur - 10))], fill="#B8B0A0", width=6)
        d.line([(cadre, y), (cadre, min(y + 24, hauteur - 10))], fill="#B8B0A0", width=6)
    milieu = cadre // 2 + 5
    t = TEXTES[langue]
    d.text((milieu, hauteur // 2 - 40), t["logo"], font=police(600, 64), fill=MUTED, anchor="mm")
    d.text((milieu, hauteur // 2 + 40), t["aide"][0], font=police(400, 34), fill=MUTED, anchor="mm")
    d.text((milieu, hauteur // 2 + 88), t["aide"][1], font=police(400, 34), fill=MUTED, anchor="mm")
    img.save(SORTIE / f"logo-entreprise-{langue}.png")


def signature_ima(langue: str):
    # 1004 × 284 dans le formulaire d'origine, dessiné en double résolution
    largeur, hauteur = 2008, 568
    img = Image.new("RGB", (largeur, hauteur), "white")
    logo = Image.open(RACINE / "assets/logo-ima.png").convert("RGBA")
    taille = 300
    logo = logo.resize((taille, round(taille * logo.height / logo.width)))
    img.paste(logo, (largeur - taille - 10, 40), logo)
    d = ImageDraw.Draw(img)
    x = largeur - taille - 50
    d.text((x, 150), "INSTITUT MINDSET EN ACTION®", font=police(700, 46), fill=GOLD_TEXT, anchor="rs")
    d.rectangle([(x - 140, 180), (x, 186)], fill=GOLD)
    t = TEXTES[langue]
    d.text((x, 262), t["mis"], font=police(600, 40), fill=NAVY, anchor="rs")
    d.text((x, 322), t["officiel"][0], font=police(400, 34), fill=MUTED, anchor="rs")
    d.text((x, 368), t["officiel"][1], font=police(400, 34), fill=MUTED, anchor="rs")
    img.save(SORTIE / f"signature-ima-spf-{langue}.png")


CADRE_SIMPLE = {
    "fr": ("Logo de votre entreprise", "Clic droit › Modifier l'image"),
    "nl": ("Logo van uw onderneming", "Rechtsklikken › Afbeelding wijzigen"),
    "pt-BR": ("Logotipo da sua empresa", "Clique com o botão direito › Alterar imagem"),
    "en": ("Your company logo", "Right-click › Change Picture"),
}


def cadre_logo_simple(langue: str):
    # Modèles IMA (non protégés) : l'entreprise remplace simplement l'image (proportion 3 : 1)
    largeur, hauteur = 900, 300
    img = Image.new("RGB", (largeur, hauteur), "white")
    d = ImageDraw.Draw(img)
    for x in range(6, largeur - 6, 30):
        d.line([(x, 6), (min(x + 18, largeur - 6), 6)], fill="#B8B0A0", width=4)
        d.line([(x, hauteur - 6), (min(x + 18, largeur - 6), hauteur - 6)], fill="#B8B0A0", width=4)
    for y in range(6, hauteur - 6, 30):
        d.line([(6, y), (6, min(y + 18, hauteur - 6))], fill="#B8B0A0", width=4)
        d.line([(largeur - 6, y), (largeur - 6, min(y + 18, hauteur - 6))], fill="#B8B0A0", width=4)
    titre, aide = CADRE_SIMPLE[langue]
    d.text((largeur // 2, hauteur // 2 - 22), titre, font=police(600, 48), fill=MUTED, anchor="mm")
    d.text((largeur // 2, hauteur // 2 + 40), aide, font=police(400, 30), fill=MUTED, anchor="mm")
    img.save(SORTIE / f"logo-entreprise-simple-{langue}.png")


if __name__ == "__main__":
    SORTIE.mkdir(parents=True, exist_ok=True)
    for langue in TEXTES:
        cadre_logo(langue)
        signature_ima(langue)
    for langue in CADRE_SIMPLE:
        cadre_logo_simple(langue)
    print("ok")
