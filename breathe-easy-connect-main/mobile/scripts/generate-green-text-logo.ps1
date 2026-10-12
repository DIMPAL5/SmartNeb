Add-Type -AssemblyName System.Drawing

function Generate-SmartNeb-Logo {
    param(
        [string]$outputPath,
        [int]$width,
        [int]$height,
        [bool]$isAdaptive = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gfx.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Pure clean white background
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $gfx.FillRectangle($bgBrush, 0, 0, $width, $height)
    $bgBrush.Dispose()

    # Green brand color: #16a34a (R: 22, G: 163, B: 74)
    $greenColor = [System.Drawing.Color]::FromArgb(255, 22, 163, 74)
    $textBrush = New-Object System.Drawing.SolidBrush($greenColor)

    # Determine font size
    $fontSize = [float]($width * 0.17)
    if ($isAdaptive) {
        $fontSize = [float]($width * 0.14)
    }

    # Find a clean modern font
    $fontFamily = New-Object System.Drawing.FontFamily("Segoe UI")
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

    $stringFormat = New-Object System.Drawing.StringFormat
    $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

    $rect = New-Object System.Drawing.RectangleF(0, 0, $width, $height)
    $gfx.DrawString("SmartNeb", $font, $textBrush, $rect, $stringFormat)

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $font.Dispose()
    $fontFamily.Dispose()
    $textBrush.Dispose()
    $stringFormat.Dispose()
    $gfx.Dispose()
    $bmp.Dispose()

    Write-Host "Generated: $outputPath"
}

$mobileAssets = "c:\Users\Public\SmartNeb-main\SmartNeb-main\breathe-easy-connect-main\mobile\assets"
$publicAssets = "c:\Users\Public\SmartNeb-main\SmartNeb-main\breathe-easy-connect-main\public"

Generate-SmartNeb-Logo -outputPath "$mobileAssets\icon.png" -width 1024 -height 1024
Generate-SmartNeb-Logo -outputPath "$mobileAssets\adaptive-icon.png" -width 1024 -height 1024 -isAdaptive $true
Generate-SmartNeb-Logo -outputPath "$mobileAssets\splash-icon.png" -width 1024 -height 1024 -isAdaptive $true
Generate-SmartNeb-Logo -outputPath "$mobileAssets\favicon.png" -width 48 -height 48
Generate-SmartNeb-Logo -outputPath "$publicAssets\smartneb-logo.png" -width 512 -height 512
