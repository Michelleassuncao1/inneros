"""Version IMA des formulaires officiels du SPF Emploi (module D1).

Le contenu officiel n'est pas modifié : seuls changent
- les deux logos du SPF en haut de la première page, remplacés par un cadre « logo de votre entreprise »
  et la signature IMA (mêmes dimensions, la mise en page ne bouge pas) ;
- les pieds de page, où une ligne cite la source (conditions d'utilisation de emploi.belgique.be :
  réutilisation autorisée en citant clairement la source).
La protection « remplissage de formulaires » (sans mot de passe) est conservée.

Usage (Python 3.12, depuis la racine du projet) :
    python -I scripts/modeles/personnaliser_spf.py <formulaire SPF .docx> <fichier de sortie .docx> <source>
Exemple de source : "SPF Emploi, Travail et Concertation sociale, rapport annuel SIPP, formulaire A, exercice 2025"
"""

import re
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

RACINE = Path(__file__).resolve().parents[2]
IMAGES = RACINE / "data/modeles/images"


def ligne_source(source: str) -> str:
    texte = escape(f"Formulaire officiel : {source}, contenu inchangé (source : emploi.belgique.be). Mise en page : Institut Mindset en Action®.")
    return (
        '<w:p><w:pPr><w:spacing w:after="40"/><w:jc w:val="center"/></w:pPr>'
        f'<w:r><w:rPr><w:color w:val="5A5A5A"/><w:sz w:val="14"/><w:szCs w:val="14"/></w:rPr><w:t xml:space="preserve">{texte}</w:t></w:r></w:p>'
    )


def personnaliser(entree: Path, sortie: Path, source: str):
    with zipfile.ZipFile(entree) as z:
        fichiers = {n: z.read(n) for n in z.namelist()}

    # Les deux logos du SPF : le premier (à gauche) et le second (à droite) de la première page
    document = fichiers["word/document.xml"].decode("utf-8")
    liens = fichiers["word/_rels/document.xml.rels"].decode("utf-8")
    cibles = {}
    for relation in re.findall(r"<Relationship [^>]*>", liens):  # l'ordre des attributs varie selon les fichiers
        ident, cible = re.search(r'Id="([^"]+)"', relation), re.search(r'Target="(media/[^"]+)"', relation)
        if ident and cible:
            cibles[ident.group(1)] = cible.group(1)
    # Images récentes (r:embed) ou anciennes (VML, v:imagedata r:id), selon le formulaire
    images = [cibles[r] for r in re.findall(r'(?:r:embed|<v:imagedata r:id)="([^"]+)"', document) if r in cibles][:2]
    if images != ["media/image1.png", "media/image2.png"]:
        raise SystemExit(f"Logos inattendus en tête du formulaire : {images}")
    fichiers["word/media/image1.png"] = (IMAGES / "logo-entreprise.png").read_bytes()
    fichiers["word/media/image2.png"] = (IMAGES / "signature-ima-spf.png").read_bytes()

    # Une ligne « source » au début de chaque pied de page
    pieds = [n for n in fichiers if re.fullmatch(r"word/footer\d+\.xml", n)]
    for n in pieds:
        xml = fichiers[n].decode("utf-8")
        ouverture = re.search(r"<w:ftr[^>]*>", xml)
        xml = xml[: ouverture.end()] + ligne_source(source) + xml[ouverture.end() :]
        fichiers[n] = xml.encode("utf-8")

    sortie.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(entree) as z, zipfile.ZipFile(sortie, "w", zipfile.ZIP_DEFLATED) as s:
        for info in z.infolist():  # même ordre que l'original ([Content_Types].xml en premier)
            s.writestr(info.filename, fichiers[info.filename])
    print(f"ok : {sortie.name} ({len(pieds)} pieds de page)")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    personnaliser(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
