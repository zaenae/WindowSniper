& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  $Repo = 'zaenae/WindowSniper'
  $Dest = if ($env:WINDOWSNIPER_HOME) { $env:WINDOWSNIPER_HOME } else { Join-Path $env:LOCALAPPDATA 'WindowSniper' }
  $Source = if ($env:WINDOWSNIPER_SOURCE) { $env:WINDOWSNIPER_SOURCE } else { "https://github.com/$Repo/archive/refs/heads/main.zip" }
  $Log = Join-Path $env:TEMP 'windowsniper-install.log'
  try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

  $c = { param($code) [string][char]$code }
  $fancy = [bool]$env:WT_SESSION
  $tick = if ($fancy) { & $c 0x2713 } else { & $c 0x221A }
  $frames = if ($fancy) { 0x280B, 0x2819, 0x2839, 0x2838, 0x283C, 0x2834, 0x2826, 0x2827, 0x2807, 0x280F | ForEach-Object { & $c $_ } } else { '|', '/', '-', '\' }

  function Show-Logo {
    $map = @{ '#' = (& $c 0x2588); '^' = (& $c 0x2580); 'v' = (& $c 0x2584) }
    $blocks = { param($s) -join ($s.ToCharArray() | ForEach-Object { $k = [string]$_; if ($map.ContainsKey($k)) { $map[$k] } else { $k } }) }
    $h = & $c 0x2500; $x = & $c 0x253C
    $mark = @(
      ((& $c 0x256D) + $h + $x + $h + (& $c 0x256E)),
      ($x + ' ' + (& $c 0x25CF) + ' ' + $x),
      ((& $c 0x2570) + $h + $x + $h + (& $c 0x256F))
    )
    $w1 = @('#   # ^#^ #v  # #^^^v v^^^v #   #', '#v^v#  #  # ^v# #   # #   # #v^v#', '^   ^ ^^^ ^   ^ ^^^^   ^^^  ^   ^')
    $w2 = @('v^^^^ #v  # ^#^ #^^^v #^^^^ #^^^v', ' ^^^v # ^v#  #  #^^^  #^^^  #^^# ', '^^^^  ^   ^ ^^^ ^     ^^^^^ ^   ^')
    Write-Host ''
    for ($i = 0; $i -lt 3; $i++) {
      Write-Host '  ' -NoNewline
      Write-Host $mark[$i] -ForegroundColor Red -NoNewline
      Write-Host '  ' -NoNewline
      Write-Host (& $blocks $w1[$i]) -ForegroundColor White -NoNewline
      Write-Host '   ' -NoNewline
      Write-Host (& $blocks $w2[$i]) -ForegroundColor Red
    }
    Write-Host ''
    Write-Host '         Shoot a window. It closes.   ' -NoNewline
    Write-Host "github.com/$Repo" -ForegroundColor DarkGray
    Write-Host ''
  }

  function Write-Ok($text) {
    Write-Host '  ' -NoNewline; Write-Host $tick -ForegroundColor Green -NoNewline; Write-Host " $text"
  }

  function Invoke-Quietly($message, $script) {
    $p = Start-Process powershell.exe -PassThru -WindowStyle Hidden -WorkingDirectory $Dest `
      -RedirectStandardOutput $Log -RedirectStandardError "$Log.err" `
      -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$script`"")
    $null = $p.Handle
    $i = 0
    while (-not $p.HasExited) {
      Write-Host ("`r  " + $frames[$i++ % $frames.Count] + " $message") -ForegroundColor Red -NoNewline
      Start-Sleep -Milliseconds 100
    }
    $p.WaitForExit()
    Write-Host ("`r" + (' ' * ($message.Length + 6)) + "`r") -NoNewline
    if ($p.ExitCode -ne 0) {
      $details = (Get-Content "$Log.err", $Log -ErrorAction SilentlyContinue |
        Where-Object { $_ -match '\S' -and $_ -notmatch '[\u2500-\u259F#]|%$' } | Select-Object -Last 6) -join "`n"
      throw "$message failed.`n$details"
    }
  }

  try {
    Show-Logo
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'ARM' } else { 'x64' }
    Write-Ok "Found Windows ($arch)"

    Write-Host '  ... Downloading WindowSniper' -ForegroundColor DarkGray -NoNewline
    $tmp = Join-Path $env:TEMP ('windowsniper-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    $zip = Join-Path $tmp 'source.zip'
    if (Test-Path $Source) { Copy-Item $Source $zip }
    else {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest $Source -OutFile $zip -UseBasicParsing
    }
    Expand-Archive $zip -DestinationPath $tmp -Force
    $top = Get-ChildItem $tmp -Directory | Select-Object -First 1
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    Copy-Item (Join-Path $top.FullName '*') $Dest -Recurse -Force
    Remove-Item $tmp -Recurse -Force
    Write-Host ("`r" + (' ' * 32) + "`r") -NoNewline
    Write-Ok "Downloaded to $Dest"

    $launcher = Join-Path $Dest 'tools\launch-windows.ps1'
    $env:WINDOWSNIPER_NO_START = '1'
    try { Invoke-Quietly 'Installing (about a minute the first time)' $launcher }
    finally { Remove-Item Env:WINDOWSNIPER_NO_START -ErrorAction SilentlyContinue }
    Write-Ok 'Installed'

    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Programs')) 'WindowSniper.lnk'))
    $lnk.TargetPath = Join-Path $Dest 'WindowSniper.cmd'
    $lnk.WorkingDirectory = $Dest
    $lnk.IconLocation = Join-Path $Dest 'icon\icon.ico'
    $lnk.WindowStyle = 7
    $lnk.Description = 'Shoot a window. It closes.'
    $lnk.Save()
    Write-Ok 'Added WindowSniper to the Start menu'

    Invoke-Quietly 'Starting WindowSniper' $launcher
    Write-Ok 'WindowSniper is running'

    Write-Host ''
    Write-Host '  Press ' -NoNewline; Write-Host 'Ctrl+Alt+G' -ForegroundColor White -NoNewline
    Write-Host ' to draw the gun. Click to shoot, ' -NoNewline; Write-Host 'Esc' -ForegroundColor White -NoNewline
    Write-Host ' to put it away.'
    Write-Host '  Next time, open ' -NoNewline; Write-Host 'WindowSniper' -ForegroundColor White -NoNewline
    Write-Host ' from the Start menu.'
    Write-Host ''
    Remove-Item $Log, "$Log.err" -ErrorAction SilentlyContinue
  }
  catch {
    Write-Host ''
    Write-Host "  x $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Full log: $Log" -ForegroundColor DarkGray
    Write-Host ''
  }
}
