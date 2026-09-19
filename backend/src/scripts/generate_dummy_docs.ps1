Add-Type -AssemblyName System.Drawing

function Create-DocumentImage {
    param(
        [string]$FilePath,
        [string]$Title,
        [string]$DocType,
        [string]$CardNumber,
        [int]$Red,
        [int]$Green,
        [int]$Blue
    )
    $bmp = New-Object System.Drawing.Bitmap(800, 500)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    # Background
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 252))
    $g.FillRectangle($bgBrush, 0, 0, 800, 500)

    # Card border
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(203, 213, 225), 2)
    $g.DrawRectangle($borderPen, 10, 10, 780, 480)

    # Header Bar
    $hBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($Red, $Green, $Blue))
    $g.FillRectangle($hBrush, 10, 10, 780, 80)

    # Header Text
    $hFont = New-Object System.Drawing.Font('Arial', 18, [System.Drawing.FontStyle]::Bold)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.DrawString($Title, $hFont, $whiteBrush, 30, 35)

    # Sub text
    $subFont = New-Object System.Drawing.Font('Arial', 10, [System.Drawing.FontStyle]::Regular)
    $g.DrawString('Government of India / Identification Document', $subFont, $whiteBrush, 450, 42)

    # Photo Box
    $photoPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(148, 163, 184), 2)
    $g.DrawRectangle($photoPen, 50, 130, 140, 170)
    $photoBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(226, 232, 240))
    $g.FillRectangle($photoBg, 52, 132, 136, 166)
    $pFont = New-Object System.Drawing.Font('Arial', 12, [System.Drawing.FontStyle]::Italic)
    $grayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(100, 116, 139))
    $g.DrawString('Photo', $pFont, $grayBrush, 95, 205)

    # Content
    $labelFont = New-Object System.Drawing.Font('Arial', 11, [System.Drawing.FontStyle]::Bold)
    $valueFont = New-Object System.Drawing.Font('Arial', 14, [System.Drawing.FontStyle]::Regular)
    $darkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42))

    $g.DrawString('Full Name:', $labelFont, $grayBrush, 230, 135)
    $g.DrawString('Sakshi Koparde', $valueFont, $darkBrush, 230, 155)

    $g.DrawString('Document Type:', $labelFont, $grayBrush, 230, 200)
    $g.DrawString($DocType, $valueFont, $darkBrush, 230, 220)

    $g.DrawString('Card / Reference Number:', $labelFont, $grayBrush, 230, 265)
    $g.DrawString($CardNumber, $valueFont, $darkBrush, 230, 285)

    # Watermark / Verification Footer
    $footBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(241, 245, 249))
    $g.FillRectangle($footBrush, 10, 410, 780, 80)
    $footFont = New-Object System.Drawing.Font('Arial', 10, [System.Drawing.FontStyle]::Bold)
    $greenBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, 101, 52))
    $g.DrawString('VERIFIED DIGITALLY FOR HRMS ONBOARDING COMPLIANCE', $footFont, $greenBrush, 30, 440)

    $dir = Split-Path $FilePath
    if (-not (Test-Path $dir)) { 
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $bmp.Save($FilePath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $g.Dispose()
    $bmp.Dispose()
}

$base = "c:\Users\Shubham\OneDrive\Desktop\HRMS-Portal\backend\uploads\onboarding_documents"

Create-DocumentImage (Join-Path $base "sakshiPancard_1789805202509_ptmv6.jpeg") "INCOME TAX DEPARTMENT" "PAN CARD" "ABCDE1234F" 30 58 138
Create-DocumentImage (Join-Path $base "sakshiPancard_1789805195276_eolq1.jpeg") "INCOME TAX DEPARTMENT" "PAN CARD" "ABCDE1234F" 30 58 138
Create-DocumentImage (Join-Path $base "Sakshi_K_Aadharcard_1789805292725_kixuu.jpeg") "UNIQUE IDENTIFICATION AUTHORITY" "AADHAAR CARD" "XXXX-XXXX-9012" 194 65 12
Create-DocumentImage (Join-Path $base "Sakshi_K_Aadharcard_1789805236111_tc5og.jpeg") "UNIQUE IDENTIFICATION AUTHORITY" "AADHAAR CARD" "XXXX-XXXX-9012" 194 65 12
Create-DocumentImage (Join-Path $base "Sakshi_K_Aadharcard_1789805227610_0u4ta.jpeg") "UNIQUE IDENTIFICATION AUTHORITY" "AADHAAR CARD" "XXXX-XXXX-9012" 194 65 12
Create-DocumentImage (Join-Path $base "SakshiK_CollegeID_1789812257701_za71e.jpeg") "UNIVERSITY STUDENT ID" "COLLEGE ID CARD" "STU-2024-8841" 79 70 229

Write-Host "Images created successfully."
