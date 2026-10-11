<#
    serve.ps1 - zero-dependency static server for this project.

    The site is plain HTML, CSS and JavaScript, so it needs no build
    step. It does need to be served over http:// rather than opened as
    a file, because browsers refuse module scripts, and some fetch and
    storage APIs, on a file:// origin.

    This uses only .NET's HttpListener, which ships with Windows, so
    there is nothing to install: no Node, no Python.

        .\tools\serve.ps1              # http://localhost:8080
        .\tools\serve.ps1 -Port 4000

    Stop it with Ctrl+C.

    NOTE: this file is deliberately ASCII only. Windows PowerShell 5.1
    reads a script without a byte-order mark as ANSI, so a stray em
    dash or smart quote in here becomes a parser error.
#>
[CmdletBinding()]
param(
    [int]$Port = 8080,
    [string]$Root = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue

# $PSScriptRoot is not reliably populated while param defaults are
# evaluated in Windows PowerShell 5.1, so the project root is resolved
# here instead: the folder above \tools.
if ([string]::IsNullOrWhiteSpace($Root)) {
    $scriptPath = $MyInvocation.MyCommand.Path
    if ([string]::IsNullOrWhiteSpace($scriptPath)) { $scriptPath = $PSCommandPath }
    $Root = Split-Path -Parent (Split-Path -Parent $scriptPath)
}
$Root = (Resolve-Path $Root).Path
if (-not (Test-Path (Join-Path $Root 'index.html'))) {
    throw "No index.html in $Root. Is -Root pointing at the project folder?"
}

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.mjs'  = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.sql'  = 'text/plain; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.webp' = 'image/webp'
    '.avif' = 'image/avif'
    '.gif'  = 'image/gif'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.txt'  = 'text/plain; charset=utf-8'
    '.wasm' = 'application/wasm'
    '.map'  = 'application/json; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    throw "Could not listen on port $Port. Another process may be using it; try -Port 8081. ($($_.Exception.Message))"
}

Write-Host ""
Write-Host "  V Rohit Rai Unisex Salon" -ForegroundColor White
Write-Host "  serving $Root"
Write-Host "  http://localhost:$Port/" -ForegroundColor Yellow
Write-Host "  Ctrl+C to stop"
Write-Host ""

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $relative = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath).TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
            $relative = $relative -replace '/', '\'

            $target = Join-Path $Root $relative

            # A directory request serves its index.html.
            if ((Test-Path $target) -and (Get-Item $target).PSIsContainer) {
                $target = Join-Path $target 'index.html'
            }

            # Refuse anything that escapes the project folder.
            $full = [System.IO.Path]::GetFullPath($target)
            if (-not $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
                $response.StatusCode = 403
                $body = [System.Text.Encoding]::UTF8.GetBytes('403 Forbidden')
                $response.OutputStream.Write($body, 0, $body.Length)
                Write-Host ("  403  " + $request.Url.AbsolutePath) -ForegroundColor Red
                continue
            }

            if (Test-Path $full -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
                $type = $mime[$ext]
                if (-not $type) { $type = 'application/octet-stream' }

                $bytes = [System.IO.File]::ReadAllBytes($full)
                $response.ContentType = $type
                $response.ContentLength64 = $bytes.Length
                # No caching: this is a dev server, and a stale CSS file
                # during a design pass is worse than re-reading it.
                $response.Headers.Add('Cache-Control', 'no-store')
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host ("  200  " + $request.Url.AbsolutePath) -ForegroundColor DarkGray
            } else {
                $response.StatusCode = 404
                $response.ContentType = 'text/html; charset=utf-8'
                $safePath = [System.Web.HttpUtility]::HtmlEncode($request.Url.AbsolutePath)
                $html = "<!doctype html><meta charset=utf-8><title>404</title>" +
                        "<body style='font:16px/1.6 system-ui;padding:3rem;background:#F7F3ED;color:#1C1815'>" +
                        "<h1 style='font-weight:400'>404</h1><p>No file at <code>$safePath</code></p>" +
                        "<p><a href='/'>Back to the homepage</a></p>"
                $body = [System.Text.Encoding]::UTF8.GetBytes($html)
                $response.OutputStream.Write($body, 0, $body.Length)
                Write-Host ("  404  " + $request.Url.AbsolutePath) -ForegroundColor Yellow
            }
        } catch {
            Write-Host ("  500  " + $_.Exception.Message) -ForegroundColor Red
            try { $response.StatusCode = 500 } catch { }
        } finally {
            try { $response.OutputStream.Close() } catch { }
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host "  stopped" -ForegroundColor DarkGray
}
