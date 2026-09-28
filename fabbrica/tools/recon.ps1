<#
.SYNOPSIS
  La Fabbrica - Fase 0: ricognizione dell'ambiente su Windows (sola lettura).

.DESCRIPTION
  Non installa e non modifica nulla. Raccoglie:
    - sistema (Windows, CPU, RAM, percorsi lunghi, code page)
    - GPU (nvidia-smi) e dischi
    - Python, uv, winget, git, Node, Claude Code
    - FFmpeg: libass, loudnorm, x264, NVENC (con una prova di encoding vera:
      l'elenco -encoders mostra NVENC anche quando non c'e' una GPU NVIDIA)
    - OBS: versione, profilo attivo, tela, fps, formato e cartella di registrazione,
      tracce audio registrate, instradamento delle sorgenti audio sulle tracce,
      scene, sorgenti di overlay, WebSocket (la password NON viene letta), plugin utili
    - ultime registrazioni con ffprobe (risoluzione, fps, tracce audio, capitoli)
    - DaVinci Resolve, Stream Deck, font del brand

  Salva un JSON sul Desktop e lo copia negli appunti: incollalo nella chat con Claude.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\recon.ps1
#>
[CmdletBinding()]
param(
    [string]$OutFile = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'fabbrica-recon.json')
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$report = [ordered]@{
    schema       = 'fabbrica-recon/1'
    generated_at = (Get-Date).ToString('s')
    computer     = $env:COMPUTERNAME
}
$warnings = New-Object System.Collections.Generic.List[string]

# ---------------------------------------------------------------- helper

function Write-Check([string]$Status, [string]$Label, [string]$Detail = '') {
    $colors = @{ OK = 'Green'; WARN = 'Yellow'; MANCA = 'Red'; INFO = 'Cyan' }
    Write-Host ('[{0,-5}] ' -f $Status) -ForegroundColor $colors[$Status] -NoNewline
    Write-Host ('{0,-30} {1}' -f $Label, $Detail)
    if ($Status -eq 'WARN' -or $Status -eq 'MANCA') { $warnings.Add("${Label}: $Detail") }
}

function Write-Section([string]$Title) {
    Write-Host ''
    Write-Host "== $Title" -ForegroundColor White
}

function Get-Exe([string]$Name) {
    $c = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return $c.Source }
    return $null
}

function Invoke-Native([string]$Exe, [string[]]$Arguments) {
    try {
        $out = & $Exe @Arguments 2>&1 | ForEach-Object { "$_" }
        return [pscustomobject]@{ Ok = $true; ExitCode = $LASTEXITCODE; Output = @($out) }
    } catch {
        return [pscustomobject]@{ Ok = $false; ExitCode = -1; Output = @("$_") }
    }
}

function Read-Ini([string]$Path) {
    $ini = @{}
    $section = ''
    foreach ($line in (Get-Content -LiteralPath $Path -Encoding UTF8 -ErrorAction SilentlyContinue)) {
        if ($line -match '^\s*\[(.+)\]\s*$') {
            $section = $Matches[1]
            if (-not $ini.ContainsKey($section)) { $ini[$section] = @{} }
        } elseif ($section -and $line -match '^\s*([^=;#]+?)\s*=\s*(.*)$') {
            $ini[$section][$Matches[1]] = $Matches[2]
        }
    }
    return $ini
}

function Get-IniValue($Ini, [string]$Section, [string]$Key) {
    if ($Ini -and $Ini.ContainsKey($Section) -and $Ini[$Section].ContainsKey($Key)) { return $Ini[$Section][$Key] }
    return $null
}

function ConvertFrom-TrackMask($Mask) {
    $m = 0
    if (-not [int]::TryParse("$Mask", [ref]$m)) { return @() }
    return @(1..6 | Where-Object { $m -band (1 -shl ($_ - 1)) })
}

# ---------------------------------------------------------------- sistema

Write-Section 'Sistema'
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cs = Get-CimInstance Win32_ComputerSystem
$ramGB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
$report.os = [ordered]@{ caption = $os.Caption; version = $os.Version; build = $os.BuildNumber; arch = $os.OSArchitecture }
$report.cpu = [ordered]@{ name = "$($cpu.Name)".Trim(); cores = $cpu.NumberOfCores; threads = $cpu.NumberOfLogicalProcessors }
$report.ram_gb = $ramGB
Write-Check INFO 'Windows' "$($os.Caption) build $($os.BuildNumber) $($os.OSArchitecture)"
Write-Check INFO 'CPU' "$($report.cpu.name) - $($cpu.NumberOfCores) core / $($cpu.NumberOfLogicalProcessors) thread"
Write-Check $(if ($ramGB -ge 16) { 'OK' } else { 'WARN' }) 'RAM' "$ramGB GB"

$lp = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
$report.long_paths_enabled = ($lp -eq 1)
Write-Check $(if ($lp -eq 1) { 'OK' } else { 'WARN' }) 'Percorsi lunghi (>260 car.)' $(if ($lp -eq 1) { 'abilitati' } else { 'disabilitati: li abilitiamo in M0' })

$acp = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Nls\CodePage' -Name ACP -ErrorAction SilentlyContinue).ACP
$report.ansi_codepage = $acp
Write-Check INFO 'Code page ANSI' $(if ($acp -eq '65001') { "$acp (UTF-8)" } else { "$acp" })

# ---------------------------------------------------------------- GPU

Write-Section 'GPU'
$report.gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object { [ordered]@{ name = $_.Name; driver = $_.DriverVersion } })
foreach ($g in $report.gpus) { Write-Check INFO 'Scheda video' "$($g.name) (driver $($g.driver))" }

$report.nvidia = $null
$smi = Get-Exe 'nvidia-smi'
if (-not $smi -and (Test-Path "$env:SystemRoot\System32\nvidia-smi.exe")) { $smi = "$env:SystemRoot\System32\nvidia-smi.exe" }
if ($smi) {
    $r = Invoke-Native $smi @('--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits')
    if ($r.ExitCode -eq 0 -and $r.Output.Count -gt 0) {
        $parts = @($r.Output[0].Split(',') | ForEach-Object { $_.Trim() })
        $report.nvidia = [ordered]@{ name = $parts[0]; vram_mb = $parts[1]; driver = $parts[2] }
        Write-Check OK 'NVIDIA (nvidia-smi)' "$($parts[0]) - $($parts[1]) MB VRAM - driver $($parts[2])"
    } else {
        Write-Check WARN 'nvidia-smi' (($r.Output | Select-Object -First 2) -join ' ')
    }
} else {
    Write-Check INFO 'NVIDIA' 'nessuna GPU NVIDIA: si va sul percorso CPU'
}

# ---------------------------------------------------------------- dischi

Write-Section 'Dischi'
$report.disks = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
        [ordered]@{ drive = $_.DeviceID; label = $_.VolumeName; size_gb = [math]::Round($_.Size / 1GB, 0); free_gb = [math]::Round($_.FreeSpace / 1GB, 0) }
    })
foreach ($d in $report.disks) {
    # Una live di 1 ora occupa circa 15-20 GB tra sorgente, WAV, proxy e clip.
    Write-Check $(if ($d.free_gb -ge 150) { 'OK' } else { 'WARN' }) "Disco $($d.drive) $($d.label)" "$($d.free_gb) GB liberi su $($d.size_gb) GB"
}
try {
    $report.physical_disks = @(Get-PhysicalDisk -ErrorAction Stop | ForEach-Object {
            [ordered]@{ name = $_.FriendlyName; media = "$($_.MediaType)"; size_gb = [math]::Round($_.Size / 1GB, 0) }
        })
    foreach ($p in $report.physical_disks) { Write-Check INFO 'Disco fisico' "$($p.name) - $($p.media) - $($p.size_gb) GB" }
} catch {}

# ---------------------------------------------------------------- strumenti

Write-Section 'Strumenti'
$tools = [ordered]@{}

$pyl = Get-Exe 'py'
if ($pyl) { $tools.py_launcher = @((Invoke-Native $pyl @('-0p')).Output) }
$pyExe = Get-Exe 'python'
if ($pyExe -and $pyExe -like '*\WindowsApps\*') {
    $tools.python_on_path = 'alias del Microsoft Store (non e'' un Python vero)'
    $pyExe = $null
} elseif ($pyExe) {
    $tools.python_on_path = ((Invoke-Native $pyExe @('--version')).Output -join ' ')
    $tools.python_path = $pyExe
}
$pyAll = (@($tools.py_launcher) + @($tools.python_on_path)) -join ' '
if ($pyAll -match '3\.1[1-3]') {
    Write-Check OK 'Python' ($pyAll -replace '\s+', ' ').Trim()
} else {
    Write-Check MANCA 'Python 3.11/3.12' 'winget install -e --id Python.Python.3.12  (oppure: uv python install 3.12)'
}

$simple = @(
    @{ key = 'uv'; exe = 'uv'; args = @('--version'); fix = 'winget install -e --id astral-sh.uv'; required = $true },
    @{ key = 'winget'; exe = 'winget'; args = @('--version'); fix = 'aggiorna "Programma di installazione app" dal Microsoft Store'; required = $true },
    @{ key = 'git'; exe = 'git'; args = @('--version'); fix = 'winget install -e --id Git.Git'; required = $true },
    @{ key = 'node'; exe = 'node'; args = @('--version'); fix = 'non serve a La Fabbrica'; required = $false },
    @{ key = 'claude'; exe = 'claude'; args = @('--version'); fix = 'serve solo per il provider LLM claude_cli'; required = $false }
)
foreach ($t in $simple) {
    $exe = Get-Exe $t.exe
    if ($exe) {
        $v = ((Invoke-Native $exe $t.args).Output | Select-Object -First 1)
        $tools[$t.key] = "$v"
        Write-Check OK $t.key "$v"
    } else {
        $tools[$t.key] = $null
        Write-Check $(if ($t.required) { 'MANCA' } else { 'INFO' }) $t.key $t.fix
    }
}
$report.tools = $tools

# ---------------------------------------------------------------- FFmpeg

Write-Section 'FFmpeg'
$ffmpeg = [ordered]@{ path = $null }
$ff = Get-Exe 'ffmpeg'
$ffprobe = Get-Exe 'ffprobe'
if ($ff) {
    $ver = Invoke-Native $ff @('-hide_banner', '-version')
    $filters = (Invoke-Native $ff @('-hide_banner', '-filters')).Output -join "`n"
    $encoders = (Invoke-Native $ff @('-hide_banner', '-encoders')).Output -join "`n"
    $ffmpeg.path = $ff
    $ffmpeg.version = $ver.Output[0]
    $ffmpeg.ffprobe = [bool]$ffprobe
    $ffmpeg.libass = [bool]($filters -match '(?m)^\s*\S+\s+ass\s')
    $ffmpeg.subtitles_filter = [bool]($filters -match '(?m)^\s*\S+\s+subtitles\s')
    $ffmpeg.loudnorm = [bool]($filters -match '(?m)^\s*\S+\s+loudnorm\s')
    $ffmpeg.libx264 = [bool]($encoders -match 'libx264')
    $ffmpeg.nvenc_listed = [bool]($encoders -match 'h264_nvenc')
    $ffmpeg.nvenc_works = $false
    if ($ffmpeg.nvenc_listed) {
        $t = Invoke-Native $ff @('-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=black:s=1080x1920:r=30:d=1', '-c:v', 'h264_nvenc', '-f', 'null', '-')
        $ffmpeg.nvenc_works = ($t.ExitCode -eq 0)
        if (-not $ffmpeg.nvenc_works) { $ffmpeg.nvenc_error = (($t.Output | Select-Object -First 3) -join ' ') }
    }
    Write-Check OK 'ffmpeg' $ffmpeg.version
    Write-Check $(if ($ffprobe) { 'OK' } else { 'MANCA' }) 'ffprobe' $(if ($ffprobe) { $ffprobe } else { 'winget install -e --id Gyan.FFmpeg' })
    Write-Check $(if ($ffmpeg.libass) { 'OK' } else { 'MANCA' }) 'libass (filtro ass)' $(if ($ffmpeg.libass) { 'presente' } else { 'serve la build "full": winget install -e --id Gyan.FFmpeg' })
    Write-Check $(if ($ffmpeg.loudnorm) { 'OK' } else { 'MANCA' }) 'loudnorm' ''
    Write-Check $(if ($ffmpeg.libx264) { 'OK' } else { 'MANCA' }) 'libx264' ''
    if ($report.nvidia) {
        Write-Check $(if ($ffmpeg.nvenc_works) { 'OK' } else { 'WARN' }) 'NVENC (prova vera)' $(if ($ffmpeg.nvenc_works) { 'encoding riuscito' } else { "fallito: $($ffmpeg.nvenc_error)" })
    } else {
        Write-Check INFO 'NVENC' 'non applicabile senza GPU NVIDIA'
    }
} else {
    Write-Check MANCA 'ffmpeg' 'winget install -e --id Gyan.FFmpeg  (build full: libass + NVENC)'
}
$report.ffmpeg = $ffmpeg

# ---------------------------------------------------------------- OBS

Write-Section 'OBS Studio'
$obs = [ordered]@{ installed = $false }
$obsExe = "$env:ProgramFiles\obs-studio\bin\64bit\obs64.exe"
$obsCfg = Join-Path $env:APPDATA 'obs-studio'
if (Test-Path -LiteralPath $obsExe) {
    $obs.installed = $true
    $obs.version = (Get-Item -LiteralPath $obsExe).VersionInfo.ProductVersion
    Write-Check OK 'OBS' "versione $($obs.version)"
} else {
    Write-Check WARN 'OBS' "non trovato in $obsExe"
}

if (Test-Path -LiteralPath $obsCfg) {
    # OBS 31+ usa user.ini, le versioni precedenti global.ini
    $globalIniPath = @('user.ini', 'global.ini') | ForEach-Object { Join-Path $obsCfg $_ } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    $globalIni = if ($globalIniPath) { Read-Ini $globalIniPath } else { @{} }
    $profileDir = Get-IniValue $globalIni 'Basic' 'ProfileDir'
    $sceneFile = Get-IniValue $globalIni 'Basic' 'SceneCollectionFile'
    $obs.active_profile = Get-IniValue $globalIni 'Basic' 'Profile'
    $obs.active_scene_collection = Get-IniValue $globalIni 'Basic' 'SceneCollection'

    $profilesRoot = Join-Path $obsCfg 'basic\profiles'
    $profileDirs = @()
    if ($profileDir -and (Test-Path -LiteralPath (Join-Path $profilesRoot $profileDir))) {
        $profileDirs = @(Get-Item -LiteralPath (Join-Path $profilesRoot $profileDir))
    } elseif (Test-Path -LiteralPath $profilesRoot) {
        $profileDirs = @(Get-ChildItem -LiteralPath $profilesRoot -Directory)
    }

    $obs.profiles = @()
    foreach ($pd in $profileDirs) {
        $ini = Read-Ini (Join-Path $pd.FullName 'basic.ini')
        $mode = Get-IniValue $ini 'Output' 'Mode'
        if ($mode -eq 'Advanced') {
            $recPath = Get-IniValue $ini 'AdvOut' 'RecFilePath'
            $recFormat = Get-IniValue $ini 'AdvOut' 'RecFormat2'
            if (-not $recFormat) { $recFormat = Get-IniValue $ini 'AdvOut' 'RecFormat' }
            $tracks = ConvertFrom-TrackMask (Get-IniValue $ini 'AdvOut' 'RecTracks')
            if ($tracks.Count -eq 0) { $tracks = @(1) }
        } else {
            $recPath = Get-IniValue $ini 'SimpleOutput' 'FilePath'
            $recFormat = Get-IniValue $ini 'SimpleOutput' 'RecFormat2'
            if (-not $recFormat) { $recFormat = Get-IniValue $ini 'SimpleOutput' 'RecFormat' }
            $tracks = ConvertFrom-TrackMask (Get-IniValue $ini 'SimpleOutput' 'RecTracks')
            if ($tracks.Count -eq 0) { $tracks = @(1) }
        }
        $fpsType = Get-IniValue $ini 'Video' 'FPSType'
        $fps = switch ($fpsType) {
            '1' { Get-IniValue $ini 'Video' 'FPSInt' }
            '2' { '{0}/{1}' -f (Get-IniValue $ini 'Video' 'FPSNum'), (Get-IniValue $ini 'Video' 'FPSDen') }
            default { Get-IniValue $ini 'Video' 'FPSCommon' }
        }
        $p = [ordered]@{
            name          = $pd.Name
            output_mode   = $mode
            canvas        = '{0}x{1}' -f (Get-IniValue $ini 'Video' 'BaseCX'), (Get-IniValue $ini 'Video' 'BaseCY')
            output        = '{0}x{1}' -f (Get-IniValue $ini 'Video' 'OutputCX'), (Get-IniValue $ini 'Video' 'OutputCY')
            fps           = $fps
            rec_path      = $recPath
            rec_format    = $recFormat
            rec_tracks    = $tracks
            audio_rate_hz = Get-IniValue $ini 'Audio' 'SampleRate'
        }
        $obs.profiles += $p
        Write-Check INFO "Profilo '$($pd.Name)'" "tela $($p.canvas), uscita $($p.output), $fps fps, modalita' $mode"
        Write-Check INFO '  registrazione' "$recFormat in $recPath - tracce audio: $($tracks -join ', ')"
    }

    if ($sceneFile) {
        $scenePath = Join-Path $obsCfg "basic\scenes\$sceneFile.json"
        if (Test-Path -LiteralPath $scenePath) {
            try {
                $sc = Get-Content -LiteralPath $scenePath -Raw -Encoding UTF8 | ConvertFrom-Json
                $obs.scenes = @($sc.scene_order | ForEach-Object { $_.name })
                Write-Check INFO 'Scene' ($obs.scenes -join ' | ')

                $audio = @()
                foreach ($k in 'DesktopAudioDevice1', 'DesktopAudioDevice2', 'AuxAudioDevice1', 'AuxAudioDevice2', 'AuxAudioDevice3', 'AuxAudioDevice4') {
                    $s = $sc.$k
                    if ($s) { $audio += [ordered]@{ name = $s.name; type = $s.id; tracks = @(ConvertFrom-TrackMask $s.mixers) } }
                }
                foreach ($s in @($sc.sources | Where-Object { $_.id -match 'wasapi|asio|audio|input_capture|output_capture|dshow' })) {
                    $audio += [ordered]@{ name = $s.name; type = $s.id; tracks = @(ConvertFrom-TrackMask $s.mixers) }
                }
                $obs.audio_routing = $audio
                foreach ($a in $audio) { Write-Check INFO '  sorgente audio' "$($a.name) -> tracce $($a.tracks -join ',')" }

                $obs.overlay_sources = @($sc.sources | Where-Object { $_.id -match 'image_source|browser_source|text_gdiplus|text_ft2' } |
                        ForEach-Object { [ordered]@{ name = $_.name; type = $_.id } })
                if ($obs.overlay_sources.Count -gt 0) {
                    Write-Check INFO 'Possibili overlay' (($obs.overlay_sources | ForEach-Object { $_.name }) -join ' | ')
                }
            } catch {
                Write-Check WARN 'Collezione scene' "non leggibile: $_"
            }
        }
    }

    $wsCfgPath = Join-Path $obsCfg 'plugin_config\obs-websocket\config.json'
    if (Test-Path -LiteralPath $wsCfgPath) {
        try {
            $ws = Get-Content -LiteralPath $wsCfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
            # La password non viene letta ne' copiata.
            $obs.websocket = [ordered]@{ enabled = [bool]$ws.server_enabled; port = $ws.server_port; auth_required = [bool]$ws.auth_required }
            Write-Check $(if ($ws.server_enabled) { 'OK' } else { 'WARN' }) 'OBS WebSocket' $(if ($ws.server_enabled) { "attivo sulla porta $($ws.server_port), autenticazione: $($ws.auth_required)" } else { 'disattivato: Strumenti > Impostazioni server WebSocket' })
        } catch {}
    } else {
        Write-Check WARN 'OBS WebSocket' 'configurazione non trovata'
    }

    $pluginHits = @()
    foreach ($dir in @("$env:ProgramFiles\obs-studio\obs-plugins\64bit", "$env:ProgramData\obs-studio\plugins")) {
        if (Test-Path -LiteralPath $dir) {
            $pluginHits += @(Get-ChildItem -LiteralPath $dir -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -match 'vertical|aitum|source-record|advanced-scene|streamdeck|stream-deck|websocket|move' } |
                    ForEach-Object { $_.BaseName })
        }
    }
    $obs.relevant_plugins = @($pluginHits | Sort-Object -Unique)
    if ($obs.relevant_plugins.Count -gt 0) { Write-Check INFO 'Plugin rilevanti' ($obs.relevant_plugins -join ', ') }
} else {
    Write-Check WARN 'Configurazione OBS' "non trovata in $obsCfg"
}

# Ultime registrazioni, lette con ffprobe
$obs.recent_recordings = @()
$recDirs = @($obs.profiles | ForEach-Object { $_.rec_path } | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Sort-Object -Unique)
foreach ($rd in $recDirs) {
    $files = @(Get-ChildItem -LiteralPath $rd -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Extension -in '.mkv', '.mp4', '.mov', '.flv' } | Sort-Object LastWriteTime -Descending)
    $totalGB = [math]::Round((($files | Measure-Object Length -Sum).Sum) / 1GB, 1)
    Write-Check INFO "Registrazioni in $rd" "$($files.Count) file, $totalGB GB"
    foreach ($f in ($files | Select-Object -First 3)) {
        $info = [ordered]@{ file = $f.Name; size_gb = [math]::Round($f.Length / 1GB, 2); modified = $f.LastWriteTime.ToString('s') }
        if ($ffprobe) {
            $pr = Invoke-Native $ffprobe @('-v', 'error', '-show_chapters', '-show_entries', 'format=duration:stream=index,codec_type,codec_name,width,height,avg_frame_rate,channels', '-of', 'json', $f.FullName)
            try {
                $j = ($pr.Output -join "`n") | ConvertFrom-Json
                $v = @($j.streams | Where-Object { $_.codec_type -eq 'video' }) | Select-Object -First 1
                $info.duration_min = [math]::Round([double]$j.format.duration / 60, 1)
                $info.video = if ($v) { "$($v.codec_name) $($v.width)x$($v.height) @ $($v.avg_frame_rate)" } else { $null }
                $info.audio_streams = @($j.streams | Where-Object { $_.codec_type -eq 'audio' } | ForEach-Object { "$($_.codec_name) $($_.channels)ch" })
                $info.chapters = if ($j.chapters) { @($j.chapters).Count } else { 0 }
            } catch {}
        }
        $obs.recent_recordings += $info
        Write-Check INFO "  $($f.Name)" "$($info.size_gb) GB, $($info.duration_min) min, $($info.video), audio: $($info.audio_streams.Count) tracce, capitoli: $($info.chapters)"
    }
}
$report.obs = $obs

# ---------------------------------------------------------------- altro software

Write-Section 'Altro'
$resolve = "$env:ProgramFiles\Blackmagic Design\DaVinci Resolve\Resolve.exe"
if (Test-Path -LiteralPath $resolve) {
    $vi = (Get-Item -LiteralPath $resolve).VersionInfo
    $report.davinci_resolve = "$($vi.ProductName) $($vi.ProductVersion)".Trim()
    Write-Check OK 'DaVinci Resolve' $report.davinci_resolve
} else {
    $report.davinci_resolve = $null
    Write-Check WARN 'DaVinci Resolve' "non trovato in $resolve"
}

$sd = "$env:ProgramFiles\Elgato\StreamDeck\StreamDeck.exe"
$report.stream_deck = (Test-Path -LiteralPath $sd)
Write-Check INFO 'Stream Deck' $(if ($report.stream_deck) { 'software installato' } else { 'non installato (l''hotkey MARKER funziona anche da tastiera)' })

$fontDirs = @("$env:SystemRoot\Fonts", "$env:LOCALAPPDATA\Microsoft\Windows\Fonts") | Where-Object { Test-Path -LiteralPath $_ }
$report.fonts = [ordered]@{}
foreach ($f in 'Anton', 'Archivo', 'JetBrainsMono') {
    $hit = Get-ChildItem -LiteralPath $fontDirs -Filter "$f*" -ErrorAction SilentlyContinue | Select-Object -First 1
    $report.fonts[$f] = [bool]$hit
    Write-Check INFO "Font $f" $(if ($hit) { 'installato nel sistema' } else { 'non installato (La Fabbrica usa comunque assets/fonts)' })
}

# ---------------------------------------------------------------- riepilogo

Write-Section 'Riepilogo'
$gpuOk = $report.nvidia -and $ffmpeg.nvenc_works
$report.suggested_path = if ($gpuOk) { 'gpu: faster-whisper large-v3 su CUDA + NVENC' } elseif ($report.nvidia) { 'gpu da verificare: CUDA per whisper, NVENC non funzionante' } else { 'cpu: faster-whisper small/medium int8 + x264 in parallelo, elaborazione notturna' }
$report.warnings = @($warnings)
Write-Check INFO 'Percorso consigliato' $report.suggested_path
Write-Check INFO 'Avvisi' "$($warnings.Count)"

$json = $report | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($OutFile, $json, (New-Object System.Text.UTF8Encoding($false)))
$copied = $false
try { $json | Set-Clipboard; $copied = $true } catch {}
Write-Host ''
Write-Host "Report salvato in: $OutFile" -ForegroundColor Green
if ($copied) { Write-Host 'Il report e'' gia'' negli appunti: incollalo nella chat con Claude (Ctrl+V).' -ForegroundColor Green }
