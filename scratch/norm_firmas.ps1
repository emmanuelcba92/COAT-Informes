# Script para redimensionar firmas en PowerShell (nativo en Windows)
# Este script toma imágenes del directorio "firmas" y las redimensiona a un ancho de 800px.

$inputDir = "firmas"
$outputDir = "firmas_normalizadas"

if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir
}

Add-Type -AssemblyName System.Drawing

Get-ChildItem -Path $inputDir -Filter *.png | ForEach-Object {
    $filePath = $_.FullName
    $outputPath = Join-Path $outputDir $_.Name
    
    $img = [System.Drawing.Image]::FromFile($filePath)
    
    $newWidth = 800
    $ratio = $newWidth / $img.Width
    $newHeight = [int]($img.Height * $ratio)
    
    $newImg = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($newImg)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($img, 0, 0, $newWidth, $newHeight)
    
    $newImg.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $img.Dispose()
    $newImg.Dispose()
    
    Write-Host "Procesada: $($_.Name)"
}
