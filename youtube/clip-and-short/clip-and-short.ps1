# --- Configuration ---
# Edit these variables before running the script.
$InputFile  = "C:\Path\To\Your\InputVideo.mp4"
$Start      = "00:02:00"
$End        = "00:02:16"
$ClipDir    = "D:\youtube\Clipped"
$ShortDir   = "D:\youtube\Shorts"
$ArchiveDir = "D:\youtube\Archive"

# --- Function to Handle Numbering and Moving ---
function Move-To-Destination {
    param (
        [string]$PathToMove,
        [string]$DestinationDir,
        [string]$Prefix,
        [switch]$PreserveName
    )

    if (Test-Path $PathToMove) {
        if (-not (Test-Path $DestinationDir)) { New-Item -ItemType Directory -Path $DestinationDir | Out-Null }

        if ($PreserveName) {
            $finalName = Split-Path $PathToMove -Leaf
        } else {
            # Find the latest number (e.g., "shorts-5.mp4" -> 5)
            $existingFiles = Get-ChildItem -Path $DestinationDir -Filter "$Prefix-*.mp4"
            $maxNumber = 0
            foreach ($file in $existingFiles) {
                if ($file.BaseName -match "$Prefix-(\d+)") {
                    $num = [int]$Matches[1]
                    if ($num -gt $maxNumber) { $maxNumber = $num }
                }
            }

            $nextNumber = $maxNumber + 1
            $finalName = "$Prefix-$nextNumber.mp4"
        }

        $destinationPath = Join-Path $DestinationDir $finalName

        Move-Item -Path $PathToMove -Destination $destinationPath -Force
        Write-Host "Success: Saved to $destinationPath" -ForegroundColor Green
    } else {
        Write-Error "File not found for moving: $PathToMove"
    }
}

# --- Main Menu ---
if (-not ($InputFile) -or -not (Test-Path $InputFile)) {
    Write-Error "Input file not specified or not found: '$InputFile'. Please check your run.psd1 file."
    pause
    exit
}

Write-Host "--- Video Processing ---" -ForegroundColor Yellow
Write-Host "Using Input File: $InputFile" -ForegroundColor DarkGray
Write-Host "Using Start Time: $Start" -ForegroundColor DarkGray
Write-Host "Using End Time:   $End" -ForegroundColor DarkGray
Write-Host "------------------------"

Write-Host "1. Create Clip (Fast, no re-encoding)"
Write-Host "2. Create Short (Vertical 9:16, Blurred Background)"
Write-Host "3. Both"
$Choice = Read-Host "Select an option (1, 2, or 3)"

# --- Action Logic ---
$Processed = $false

if ($Choice -eq "1" -or $Choice -eq "3") {
    Write-Host "`nGenerating Clip..." -ForegroundColor Cyan
    $TempClip = "temp_clip_process.mp4"
    ffmpeg -hwaccel cuda -ss $Start -to $End -i $InputFile -c copy $TempClip
    if ($LASTEXITCODE -eq 0) {
        Move-To-Destination -PathToMove $TempClip -DestinationDir $ClipDir -Prefix "clipped"
        $Processed = $true
    } else {
        Write-Error "FFmpeg failed to create clip."
    }
}

if ($Choice -eq "2" -or $Choice -eq "3") {
    Write-Host "`nGenerating Short..." -ForegroundColor Cyan
    $TempShort = "temp_short_process.mp4"
    ffmpeg -hwaccel cuda -ss $Start -to $End -i $InputFile `
    -filter_complex `
    "[0:v]format=yuv420p,split=2[bg][fg]; `
     [bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:10[bg_blurred]; `
     [fg]scale=1080:-2[fg_scaled]; `
     [bg_blurred][fg_scaled]overlay=(W-w)/2:(H-h)/2" `
    -c:v hevc_nvenc -preset slow -pix_fmt yuv420p -c:a copy $TempShort

    if ($LASTEXITCODE -eq 0) {
        Move-To-Destination -PathToMove $TempShort -DestinationDir $ShortDir -Prefix "shorts"
        $Processed = $true
    } else {
        Write-Error "FFmpeg failed to create short."
    }
}


# --- Archive Process ---
if ($Processed) {
    Write-Host "`nArchiving original file..." -ForegroundColor Magenta
    # Using -PreserveName to keep the original filename for the archive
    Move-To-Destination -PathToMove $InputFile -DestinationDir $ArchiveDir -PreserveName
} elseif ("1","2","3" -notcontains $Choice) {
    Write-Host "Invalid selection. No files processed or archived." -ForegroundColor Red
}

pause
