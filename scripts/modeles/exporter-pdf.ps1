# Version PDF des modèles Word d'IMA (module D1), avec Microsoft Word (ouverture en lecture seule).
# Usage, depuis la racine du projet : powershell -File scripts/modeles/exporter-pdf.ps1
$racine = Resolve-Path "data/modeles/fichiers"
$fichiers = Get-ChildItem -Path $racine -Recurse -Filter "*.docx" | Where-Object { $_.Name -notmatch "^(rapport-annuel-sipp|jaarverslag-idpb)" }
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  foreach ($f in $fichiers) {
    $doc = $word.Documents.Open($f.FullName, $false, $true)
    $doc.ExportAsFixedFormat(($f.FullName -replace "\.docx$", ".pdf"), 17)
    $doc.Close(0)
    Write-Output "ok : $($f.Name -replace '\.docx$', '.pdf')"
  }
} finally {
  $word.Quit()
}
