<#
.SYNOPSIS
    Renders the FamilyLedger legacy launcher icons and the Play Store icon.

.DESCRIPTION
    The adaptive icon used on API 26+ is pure vector (res/drawable +
    res/mipmap-anydpi-v26). API 24 and 25 cannot render an <adaptive-icon>,
    so they still need rasters; Google Play also wants a 512px PNG for the
    store listing. This script draws the same brand geometry used by
    res/drawable/ic_launcher_foreground.xml:

        near-black plate, dark ledger card, accent rule, two muted rules

    Keep the palette in sync with res/values/colors.xml.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\generate-icons.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$AppRoot   = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ResRoot   = Join-Path $AppRoot 'app\src\main\res'
$StoreRoot = Join-Path $AppRoot 'store'

# --- Brand palette -----------------------------------------------------------
$ColourBackground = '#0B0C0E'
$ColourCard       = '#141619'
$ColourBorder     = '#25282D'
$ColourAccent     = '#9AE6B4'
$ColourMuted      = '#9BA1AA'

# Geometry is authored against the 108dp vector viewport so the raster and the
# vector mark stay identical. Every coordinate is multiplied by size / 108.
$DesignSize   = 108.0
$script:Scale = 1.0

function Get-Scaled([double] $Value) {
    return [single]($Value * $script:Scale)
}

function New-RoundedRectanglePath {
    param([single] $X, [single] $Y, [single] $Width, [single] $Height, [single] $Radius)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $Radius * 2
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-RoundPen {
    param([string] $Hex, [single] $Width)

    $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($Hex)), $Width
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    return $pen
}

function Save-Icon {
    param([System.Drawing.Bitmap] $Bitmap, [string] $Path)

    $directory = Split-Path -Parent $Path
    if (-not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $Bitmap.Dispose()
    Write-Host ("  {0} ({1} bytes)" -f $Path.Substring($AppRoot.Length + 1), (Get-Item $Path).Length)
}


function New-FamilyLedgerIcon {
    <#
        Draws a single icon. The coordinates below are the same design-space
        values used by res/drawable/ic_launcher_foreground.xml.
    #>
    param([int] $Size, [switch] $Round)

    $script:Scale = $Size / $DesignSize

    $bitmap   = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    try {
        # 1. Plate. Round icons are painted as a disc; square icons get the
        #    squircle radius the adaptive-icon mask would apply anyway.
        $plateBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($ColourBackground))
        if ($Round) {
            $graphics.FillEllipse($plateBrush, 0, 0, $Size, $Size)
        }
        else {
            $plate = New-RoundedRectanglePath -X 0 -Y 0 -Width $Size -Height $Size -Radius (Get-Scaled 22)
            $graphics.FillPath($plateBrush, $plate)
            $plate.Dispose()
        }
        $plateBrush.Dispose()

        # 2. Ledger card.
        $card = New-RoundedRectanglePath -X (Get-Scaled 30) -Y (Get-Scaled 26) -Width (Get-Scaled 48) -Height (Get-Scaled 56) -Radius (Get-Scaled 8)
        $cardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($ColourCard))
        $graphics.FillPath($cardBrush, $card)
        $cardBrush.Dispose()
        $borderPen = New-RoundPen -Hex $ColourBorder -Width (Get-Scaled 2)
        $graphics.DrawPath($borderPen, $card)
        $borderPen.Dispose()
        $card.Dispose()

        # 3. Accent rule plus two muted rules, mirroring the web app favicon.
        $accentPen = New-RoundPen -Hex $ColourAccent -Width (Get-Scaled 5)
        $graphics.DrawLine($accentPen, (Get-Scaled 39), (Get-Scaled 40), (Get-Scaled 69), (Get-Scaled 40))
        $accentPen.Dispose()

        $mutedPen = New-RoundPen -Hex $ColourMuted -Width (Get-Scaled 4.5)
        $graphics.DrawLine($mutedPen, (Get-Scaled 39), (Get-Scaled 52), (Get-Scaled 58), (Get-Scaled 52))
        $graphics.DrawLine($mutedPen, (Get-Scaled 39), (Get-Scaled 64), (Get-Scaled 66), (Get-Scaled 64))
        $mutedPen.Dispose()
    }
    finally {
        $graphics.Dispose()
    }

    return $bitmap
}

# --- Legacy rasters (API 24-25) ---------------------------------------------
# The template ships Android-robot .webp placeholders; they are deleted so the
# generated PNGs become the only ic_launcher / ic_launcher_round resources.
$densities = [ordered]@{
    'mdpi'    = 48
    'hdpi'    = 72
    'xhdpi'   = 96
    'xxhdpi'  = 144
    'xxxhdpi' = 192
}

Write-Host 'Legacy launcher icons:'
foreach ($density in $densities.Keys) {
    $size   = $densities[$density]
    $folder = Join-Path $ResRoot ("mipmap-{0}" -f $density)

    Get-ChildItem -Path $folder -Filter 'ic_launcher*.webp' -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item $_.FullName -Force }

    Save-Icon -Bitmap (New-FamilyLedgerIcon -Size $size)        -Path (Join-Path $folder 'ic_launcher.png')
    Save-Icon -Bitmap (New-FamilyLedgerIcon -Size $size -Round) -Path (Join-Path $folder 'ic_launcher_round.png')
}

# --- Play Store listing icon ------------------------------------------------
Write-Host 'Store listing icon:'
Save-Icon -Bitmap (New-FamilyLedgerIcon -Size 512) -Path (Join-Path $StoreRoot 'play-store-icon-512.png')

Write-Host 'Done.'
