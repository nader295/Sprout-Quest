$envPath = ".env.local"
$content = Get-Content $envPath

$url = ""
$key = ""

foreach ($line in $content) {
    if ($line -match "^#" -or [string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split '=', 2
    if ($parts.Length -eq 2) {
        $k = $parts[0].Trim()
        $v = $parts[1].Trim() -replace '^["'']|["'']$', ''
        if ($k -eq "NEXT_PUBLIC_SUPABASE_URL") { $url = $v }
        if ($k -eq "SUPABASE_SERVICE_ROLE_KEY") { $key = $v }
    }
}

$headers = @{ "apikey" = $key; "Authorization" = "Bearer $key" }

Write-Host "=== ROMS PREVIEW ==="
$roms = Invoke-RestMethod -Uri "$url/rest/v1/roms?limit=1" -Headers $headers
$roms | ConvertTo-Json -Depth 5

Write-Host "=== USERS PREVIEW ==="
$users = Invoke-RestMethod -Uri "$url/rest/v1/users?limit=3" -Headers $headers
$users | ConvertTo-Json -Depth 5
