$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$NodeVersion = '22.12.0'

function Test-Command($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

if (-not (Test-Command 'npm')) {
  $local = Join-Path (Get-Location) '.node'
  if (-not (Test-Path (Join-Path $local 'npm.cmd'))) {
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    $name = "node-v$NodeVersion-win-$arch"
    $zip = Join-Path $env:TEMP "$name.zip"
    $tmp = Join-Path $env:TEMP 'windowsniper-node'
    Write-Host 'Node.js not found - downloading a private copy just for WindowSniper (~30 MB, one time)...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest "https://nodejs.org/dist/v$NodeVersion/$name.zip" -OutFile $zip -UseBasicParsing
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive $zip -DestinationPath $tmp -Force
    if (Test-Path $local) { Remove-Item $local -Recurse -Force }
    Move-Item (Join-Path $tmp $name) $local
    Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
  $env:Path = "$local;$env:Path"
}

$stamp = 'node_modules\.windowsniper-package.json'
$stale = -not (Test-Path 'node_modules\electron\dist') -or -not (Test-Path $stamp) -or
         ((Get-FileHash 'package.json').Hash -ne (Get-FileHash $stamp).Hash)
if ($stale) {
  Write-Host 'Installing WindowSniper (about a minute the first time)...'
  npm install --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed (see above).' }
  Copy-Item 'package.json' $stamp
}

if ($env:WINDOWSNIPER_NO_START -eq '1') { return }
node bin/windowsniper.js @args
if ($LASTEXITCODE -ne 0) { throw 'WindowSniper failed to start (see above).' }
