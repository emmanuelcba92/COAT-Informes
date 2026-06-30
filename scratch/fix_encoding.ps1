$filePath = "e:\Proyectos con IA\Antigravity\Informes COAT\src\pages\AdminPage.jsx"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# Map of common double-encoded sequences
# UTF-8 for accented chars:
# á: C3 A1
# é: C3 A9
# í: C3 AD
# ó: C3 B3
# ú: C3 BA
# ñ: C3 B1
# Á: C3 81
# É: C3 89
# Í: C3 8D
# Ó: C3 83
# Ú: C3 9A
# ¿: C2 BF
# ¡: C2 A1

# If double encoded, á (C3 A1) becomes C3 83 C2 A1
# So we look for Ã followed by the second byte encoded as UTF-8.

$replacements = @{
    "Ã\u0081" = "Á"
    "Ã\u0089" = "É"
    "Ã\u008D" = "Í"
    "Ã\u0093" = "Ó"
    "Ã\u009A" = "Ú"
    "Ã\u00A1" = "á"
    "Ã\u00A9" = "é"
    "Ã\u00AD" = "í"
    "Ã\u00B3" = "ó"
    "Ã\u00BA" = "ú"
    "Ã\u00B1" = "ñ"
    "Â¿" = "¿"
    "Â¡" = "¡"
}

foreach ($key in $replacements.Keys) {
    $content = $content -replace [regex]::Escape($key), $replacements[$key]
}

# Special cases found in hex: C3 83 C2 8D (which is Ã followed by something that became Í)
# Actually C3 83 is Ã. C2 8D is a control char.
# Let's just fix the specific strings I found.
$content = $content -replace "Ã\s+SEGURO", "Á SEGURO"
$content = $content -replace "CATEGORÃ\s+A", "CATEGORÍA"
$content = $content -replace "categorÃ\s+a", "categoría"
$content = $content -replace "prÃ\s+ctica", "práctica"
$content = $content -replace "vÃ\s+lido", "válido"
$content = $content -replace "vÃ\s+lida", "válida"

[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
Write-Output "Fixed AdminPage.jsx encoding"
