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


def cadre_logo():
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
    d.text((milieu, hauteur // 2 - 40), "Logo de votre entreprise", font=police(600, 64), fill=MUTED, anchor="mm")
    d.text((milieu, hauteur // 2 + 40), "Révision › Restreindre la modification ›", font=police(400, 34), fill=MUTED, anchor="mm")
    d.text((milieu, hauteur // 2 + 88), "Désactiver la protection, puis remplacez ce cadre", font=police(400, 34), fill=MUTED, anchor="mm")
    img.save(SORTIE / "logo-entreprise.png")


def signature_ima():
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
    d.text((x, 262), "Modèle mis à disposition par IMA", font=police(600, 40), fill=NAVY, anchor="rs")
    d.text((x, 322), "Formulaire officiel du SPF Emploi, Travail et Concertation sociale", font=police(400, 34), fill=MUTED, anchor="rs")
    d.text((x, 368), "contenu inchangé · source : emploi.belgique.be", font=police(400, 34), fill=MUTED, anchor="rs")
    img.save(SORTIE / "signature-ima-spf.png")


if __name__ == "__main__":
    SORTIE.mkdir(parents=True, exist_ok=True)
    cadre_logo()
    signature_ima()
    print("ok")
