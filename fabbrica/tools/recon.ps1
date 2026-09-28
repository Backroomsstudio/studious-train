<#
  La Fabbrica - Fase 0: ricognizione di plugghepc (SOLA LETTURA)

  Cosa fa:     legge versioni, hardware, configurazione di OBS e i metadati
               dell'ultima registrazione.
  Cosa NON fa: non installa e non modifica nulla. Non legge password, stream key
               o token (la password di OBS WebSocket non viene mai letta).
  Unica azione attiva: un encode di prova di 1 secondo verso il nulla, per
  verificare che NVENC funzioni davvero, e una richiesta HTTPS a 3 siti.

  Uso, da PowerShell nella cartella dove hai salvato il file:
      powershell -NoProfile -ExecutionPolicy Bypass -File .\recon.ps1

  Risultato: fabbrica-recon.txt nella stessa cartella. Incollalo a Claude.
#>

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$script:out = New-Object System.Collections.Generic.List[string]
function L([string]$s = '') { Write-Host $s; $script:out.Add($s) }
function Section([string]$title, [scriptblock]$body) {
    L ''
    L ('== ' + $title + ' ==')
    try { . $body } catch { L ('  (errore in questa sezione: ' + $_.Exception.Message + ')') }
}
function Find-Cmd([string]$name) { Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 }
function Run([string]$exe, [string[]]$argv) {
    try { $r = & $exe @argv 2>$null; return ($r | Out-String).TrimEnd() } catch { return '' }
}
function First-Line([string]$s) { return (($s -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -First 1) }
function Ver([string]$label, [string]$name, [string[]]$argv) {
    $c = Find-Cmd $name
    if ($c) { L ('{0}: {1}  [{2}]' -f $label, (First-Line (Run $c.Source $argv)), $c.Source) }
    else { L ('{0}: NON trovato' -f $label) }
}
function Read-Ini([string]$path) {
    $ini = @{}; $sec = ''
    foreach ($line in (Get-Content -LiteralPath $path -Encoding UTF8)) {
        if ($line -match '^\s*\[(.+)\]\s*$') { $sec = $matches[1]; $ini[$sec] = [ordered]@{} }
        elseif ($sec -and $line -match '^\s*([^=;#]+?)\s*=\s*(.*)$') { $ini[$sec][$matches[1]] = $matches[2] }
    }
    return $ini
}
function Tracks-From-Mask([int]$mask) {
    $t = @(); for ($i = 0; $i -lt 6; $i++) { if ($mask -band (1 -shl $i)) { $t += ($i + 1) } }
    if ($t.Count -eq 0) { return 'nessuna' }
    return ($t -join ',')
}

L ('La Fabbrica - ricognizione  ' + (Get-Date -Format 'yyyy-MM-dd HH:mm'))

Section 'Sistema' {
    $os = Get-CimInstance Win32_OperatingSystem
    L ('OS: {0} {1} build {2} ({3})' -f $os.Caption, $os.Version, $os.BuildNumber, $os.OSArchitecture)
    L ('Nome PC: ' + $env:COMPUTERNAME)
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    L ('CPU: {0} - {1} core / {2} thread' -f $cpu.Name.Trim(), $cpu.NumberOfCores, $cpu.NumberOfLogicalProcessors)
    L ('RAM: {0} GB' -f [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1))
    $lp = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
    L ('Percorsi lunghi (LongPathsEnabled): ' + $(if ($lp -eq 1) { 'attivi' } else { 'NON attivi' }))
    L ('Cartella utente: ' + $env:USERPROFILE)
}

Section 'GPU' {
    Get-CimInstance Win32_VideoController | ForEach-Object { L ('Scheda video: {0} (driver {1})' -f $_.Name, $_.DriverVersion) }
    $smi = Find-Cmd 'nvidia-smi'
    $smiPath = $null
    if ($smi) { $smiPath = $smi.Source }
    elseif (Test-Path "$env:SystemRoot\System32\nvidia-smi.exe") { $smiPath = "$env:SystemRoot\System32\nvidia-smi.exe" }
    if ($smiPath) {
        L ('nvidia-smi: ' + (Run $smiPath @('--query-gpu=name,memory.total,driver_version', '--format=csv,noheader')))
        $cudaLine = ((Run $smiPath @()) -split "`r?`n") | Where-Object { $_ -match 'CUDA Version' } | Select-Object -First 1
        if ($cudaLine) { L ('  ' + ($cudaLine -replace '\s*\|\s*', ' ').Trim()) }
        $script:hasNvidia = $true
    } else {
        L 'nvidia-smi: NON trovato (nessuna GPU NVIDIA o driver assente) -> percorso CPU'
        $script:hasNvidia = $false
    }
}

Section 'Dischi' {
    Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
        L ('{0} {1} GB liberi su {2} GB  [{3}]' -f $_.DeviceID, [math]::Round($_.FreeSpace / 1GB), [math]::Round($_.Size / 1GB), $_.VolumeName)
    }
    try {
        Get-PhysicalDisk | ForEach-Object { L ('Disco fisico: {0} - {1} - {2} GB' -f $_.FriendlyName, $_.MediaType, [math]::Round($_.Size / 1GB)) }
    } catch { L '  (tipo di disco non leggibile)' }
}

Section 'Software di base' {
    Ver 'winget' 'winget' @('--version')
    Ver 'git' 'git' @('--version')
    Ver 'uv' 'uv' @('--version')
    Ver 'node' 'node' @('--version')
    Ver 'claude (Claude Code)' 'claude' @('--version')
    $py = Find-Cmd 'py'
    if ($py) {
        L 'Python launcher (py -0p):'
        ((Run $py.Source @('-0p')) -split "`r?`n") | Where-Object { $_.Trim() } | ForEach-Object { L ('  ' + $_.Trim()) }
    } else { L 'Python launcher (py): NON trovato' }
    $pys = @(Get-Command python -All -CommandType Application -ErrorAction SilentlyContinue)
    if ($pys.Count -eq 0) { L 'python: NON trovato nel PATH' }
    foreach ($p in $pys) {
        if ($p.Source -like '*WindowsApps*') { L ('python: alias del Microsoft Store, non è un vero Python  [' + $p.Source + ']') }
        else { L ('python: ' + (First-Line (Run $p.Source @('--version'))) + '  [' + $p.Source + ']') }
    }
}

Section 'FFmpeg' {
    $ff = Find-Cmd 'ffmpeg'
    if (-not $ff) { L 'ffmpeg: NON trovato'; return }
    $ver = Run $ff.Source @('-hide_banner', '-version')
    L ((First-Line $ver) + '  [' + $ff.Source + ']')
    $filters = Run $ff.Source @('-hide_banner', '-filters')
    $enc = Run $ff.Source @('-hide_banner', '-encoders')
    foreach ($lib in 'libass', 'libfreetype', 'libfontconfig', 'libharfbuzz', 'libfribidi', 'libzimg') {
        L ('  build --enable-{0,-14} {1}' -f $lib, $(if ($ver -match ('--enable-' + $lib + '(\s|$)')) { 'si' } else { 'no' }))
    }
    foreach ($f in 'ass', 'subtitles', 'loudnorm', 'ebur128', 'silencedetect', 'scdet', 'acrossfade', 'zscale') {
        L ('  filtro  {0,-14} {1}' -f $f, $(if ($filters -match ('(?m)^\s*\S{2,3}\s+' + $f + '\s')) { 'OK' } else { 'MANCA' }))
    }
    foreach ($e in 'libx264', 'h264_nvenc', 'hevc_nvenc', 'h264_qsv', 'h264_amf', 'aac') {
        L ('  encoder {0,-14} {1}' -f $e, $(if ($enc -match ('(?m)^\s*\S{6}\s+' + $e + '\s')) { 'OK' } else { 'MANCA' }))
    }
    if ($enc -match '(?m)^\s*\S{6}\s+h264_nvenc\s') {
        & $ff.Source -hide_banner -loglevel error -f lavfi -i 'color=black:s=320x240:d=1' -c:v h264_nvenc -f null - 2>$null
        L ('  test NVENC reale (1 s): ' + $(if ($LASTEXITCODE -eq 0) { 'OK' } else { 'FALLITO (exit ' + $LASTEXITCODE + ')' }))
    }
    Ver 'ffprobe' 'ffprobe' @('-hide_banner', '-version')
}

Section 'OBS Studio' {
    $obsDir = (Get-ItemProperty 'HKLM:\SOFTWARE\OBS Studio' -ErrorAction SilentlyContinue).'(default)'
    if (-not $obsDir) { $obsDir = Join-Path $env:ProgramFiles 'obs-studio' }
    $obsExe = Join-Path $obsDir 'bin\64bit\obs64.exe'
    if (Test-Path -LiteralPath $obsExe) { L ('OBS: ' + (Get-Item -LiteralPath $obsExe).VersionInfo.ProductVersion + '  [' + $obsExe + ']') }
    else { L ('OBS: non trovato in ' + $obsDir + ' (installazione portable o Steam?)') }

    $third = Join-Path $env:ProgramData 'obs-studio\plugins'
    if (Test-Path -LiteralPath $third) { Get-ChildItem -LiteralPath $third | ForEach-Object { L ('  plugin di terze parti: ' + $_.Name) } }
    $builtin = Join-Path $obsDir 'obs-plugins\64bit'
    if (Test-Path -LiteralPath $builtin) {
        Get-ChildItem -LiteralPath $builtin -Filter '*.dll' |
            Where-Object { $_.Name -match 'vertical|aitum|source-record|scene-switcher|move|streamdeck|websocket|multi' } |
            ForEach-Object { L ('  plugin: ' + $_.Name) }
    }

    $cfg = Join-Path $env:APPDATA 'obs-studio'
    $gini = $null
    foreach ($n in 'user.ini', 'global.ini') {
        $p = Join-Path $cfg $n
        if (Test-Path -LiteralPath $p) {
            $t = Read-Ini $p
            if ($t['Basic'] -and $t['Basic']['ProfileDir']) { $gini = $t; break }
        }
    }
    if (-not $gini) { L '  configurazione utente di OBS non trovata'; return }
    $b = $gini['Basic']
    L ('Profilo attivo: ' + $b['Profile'] + '   Collezione scene attiva: ' + $b['SceneCollection'])

    $prof = Join-Path $cfg ('basic\profiles\' + $b['ProfileDir'] + '\basic.ini')
    if (Test-Path -LiteralPath $prof) {
        $bi = Read-Ini $prof
        $want = '^(Base|Output)C[XY]$|^FPS|FilePath$|RecFormat|RecTracks|RecEncoder|^RecType$|^Mode$|RecQuality|^Track\dName$|RecSplit|FilenameFormatting|^RecRB$'
        foreach ($sec in 'Video', 'Output', 'SimpleOutput', 'AdvOut') {
            if (-not $bi[$sec]) { continue }
            foreach ($k in @($bi[$sec].Keys)) {
                if ($k -match $want -and $k -notmatch 'key|pass|token|secret|auth') {
                    $v = $bi[$sec][$k]
                    if ($k -eq 'RecTracks' -and $v -match '^\d+$') { $v = $v + '  (tracce ' + (Tracks-From-Mask ([int]$v)) + ')' }
                    L ('  [{0}] {1} = {2}' -f $sec, $k, $v)
                }
            }
        }
        $script:recPath = $null
        if ($bi['Output'] -and $bi['Output']['Mode'] -eq 'Advanced' -and $bi['AdvOut']) { $script:recPath = $bi['AdvOut']['RecFilePath'] }
        if (-not $script:recPath -and $bi['SimpleOutput']) { $script:recPath = $bi['SimpleOutput']['FilePath'] }
    } else { L ('  basic.ini non trovato: ' + $prof) }

    $scFile = Join-Path $cfg ('basic\scenes\' + $b['SceneCollectionFile'] + '.json')
    if (Test-Path -LiteralPath $scFile) {
        $sc = Get-Content -LiteralPath $scFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $order = @($sc.scene_order | ForEach-Object { $_.name })
        L ('Scene (' + $order.Count + '): ' + ($order -join ' | '))
        foreach ($exp in 'Attesa', 'Sala', 'Palco', 'Segnale', 'Chiusura') {
            $hit = $order | Where-Object { $_ -match $exp } | Select-Object -First 1
            L ('  scena "{0}": {1}' -f $exp, $(if ($hit) { 'trovata (' + $hit + ')' } else { 'NON trovata' }))
        }
        $all = @($sc.sources)
        foreach ($g in 'DesktopAudioDevice1', 'DesktopAudioDevice2', 'AuxAudioDevice1', 'AuxAudioDevice2', 'AuxAudioDevice3', 'AuxAudioDevice4') {
            if ($sc.$g) { $all += $sc.$g }
        }
        L 'Sorgenti (nome, tipo, tracce audio su cui finisce):'
        foreach ($s in $all) {
            if ($s.id -eq 'scene' -or $s.id -eq 'group') { continue }
            $audio = ''
            if ($s.id -match 'wasapi|asio|dshow|ffmpeg_source|vlc|browser|audio|coreaudio|pulse' -and $null -ne $s.mixers) {
                $audio = '  -> tracce ' + (Tracks-From-Mask ([int]$s.mixers))
                if ($s.muted) { $audio += ' (muto)' }
            }
            L ('  - {0}  [{1}]{2}' -f $s.name, $s.id, $audio)
        }
    } else { L ('  file della collezione scene non trovato: ' + $scFile) }

    $ws = Join-Path $cfg 'plugin_config\obs-websocket\config.json'
    if (Test-Path -LiteralPath $ws) {
        $w = Get-Content -LiteralPath $ws -Raw | ConvertFrom-Json
        L ('WebSocket: abilitato={0}  porta={1}  autenticazione={2}' -f $w.server_enabled, $w.server_port, $w.auth_required)
    } else { L 'WebSocket: configurazione non trovata (Strumenti > Impostazioni server WebSocket mai aperto?)' }

    $hk = @()
    if ($bi -and $bi['Hotkeys']) { $hk = @($bi['Hotkeys'].Keys | Where-Object { $_ -match 'Chapter|Record' -and $bi['Hotkeys'][$_] -match 'key' }) }
    L ('Hotkey registrazione/capitoli assegnati: ' + $(if ($hk.Count) { $hk -join ', ' } else { 'nessuno' }))
}

Section 'Registrazioni' {
    if (-not $script:recPath) { L 'Cartella registrazioni non letta da OBS'; return }
    L ('Cartella: ' + $script:recPath)
    if (-not (Test-Path -LiteralPath $script:recPath)) { L '  la cartella non esiste'; return }
    $files = @(Get-ChildItem -LiteralPath $script:recPath -File | Where-Object { $_.Extension -in '.mkv', '.mp4', '.mov', '.flv' } | Sort-Object LastWriteTime -Descending)
    $tot = ($files | Measure-Object Length -Sum).Sum
    L ('  {0} file video, {1} GB in totale' -f $files.Count, [math]::Round($tot / 1GB, 1))
    $files | Select-Object -First 5 | ForEach-Object { L ('  {0:yyyy-MM-dd HH:mm}  {1,7:N2} GB  {2}' -f $_.LastWriteTime, ($_.Length / 1GB), $_.Name) }
    $fp = Find-Cmd 'ffprobe'
    if ($fp -and $files.Count) {
        $j = Run $fp.Source @('-v', 'error', '-show_chapters', '-show_entries', 'format=duration,format_name,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,channels,sample_rate:stream_tags=title', '-of', 'json', $files[0].FullName)
        try {
            $info = $j | ConvertFrom-Json
            L ('Ultima registrazione: {0}  durata {1} min  formato {2}' -f $files[0].Name, [math]::Round([double]$info.format.duration / 60, 1), $info.format.format_name)
            foreach ($st in $info.streams) {
                if ($st.codec_type -eq 'video') { L ('  #{0} video {1} {2}x{3} @ {4}' -f $st.index, $st.codec_name, $st.width, $st.height, $st.r_frame_rate) }
                elseif ($st.codec_type -eq 'audio') { L ('  #{0} audio {1} {2} ch {3} Hz {4}' -f $st.index, $st.codec_name, $st.channels, $st.sample_rate, $st.tags.title) }
                else { L ('  #{0} {1} {2}' -f $st.index, $st.codec_type, $st.codec_name) }
            }
            L ('  capitoli nel file: ' + @($info.chapters).Count)
        } catch { L '  (ffprobe non ha restituito dati leggibili)' }
    }
}

Section 'Altri programmi' {
    $apps = @(
        @('DaVinci Resolve', (Join-Path $env:ProgramFiles 'Blackmagic Design\DaVinci Resolve\Resolve.exe')),
        @('Stream Deck', (Join-Path $env:ProgramFiles 'Elgato\StreamDeck\StreamDeck.exe'))
    )
    foreach ($a in $apps) {
        if (Test-Path -LiteralPath $a[1]) { $vi = (Get-Item -LiteralPath $a[1]).VersionInfo; L ('{0}: {1} {2}' -f $a[0], $vi.ProductName, $vi.ProductVersion) }
        else { L ('{0}: non trovato' -f $a[0]) }
    }
    $fontDirs = @((Join-Path $env:SystemRoot 'Fonts'), (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts')) | Where-Object { Test-Path -LiteralPath $_ }
    foreach ($f in 'Anton', 'Archivo', 'JetBrainsMono') {
        $hit = @($fontDirs | ForEach-Object { Get-ChildItem -LiteralPath $_ -Filter ($f + '*') -ErrorAction SilentlyContinue })
        L ('Font {0}: {1}' -f $f, $(if ($hit.Count) { 'installato' } else { 'non installato (lo porta il progetto)' }))
    }
}

Section 'Energia (per il batch notturno)' {
    L ((powercfg /getactivescheme) | Out-String).Trim()
    $q = (powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE) | Out-String
    $hex = [regex]::Matches($q, '0x([0-9a-fA-F]{8})')
    if ($hex.Count -ge 2) {
        $ac = [Convert]::ToInt32($hex[$hex.Count - 2].Groups[1].Value, 16)
        L ('Sospensione con alimentazione di rete dopo: ' + $(if ($ac -eq 0) { 'mai' } else { [string]([math]::Round($ac / 60)) + ' min' }))
    }
}

Section 'Rete' {
    foreach ($u in 'https://huggingface.co', 'https://pypi.org/simple/', 'https://api.anthropic.com') {
        try {
            $r = Invoke-WebRequest -Uri $u -Method Head -TimeoutSec 10 -UseBasicParsing
            L ('{0} -> raggiungibile (HTTP {1})' -f $u, $r.StatusCode)
        } catch {
            $code = $null
            if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
            L ('{0} -> {1}' -f $u, $(if ($code) { 'raggiungibile (HTTP ' + $code + ')' } else { 'NON raggiungibile' }))
        }
    }
}

$dest = Join-Path (Get-Location) 'fabbrica-recon.txt'
$script:out | Set-Content -LiteralPath $dest -Encoding UTF8
Write-Host ''
Write-Host ('Fatto. Risultato salvato in: ' + $dest)
Write-Host 'Aprilo, controlla che non ci sia nulla che non vuoi condividere e incollalo a Claude.'
