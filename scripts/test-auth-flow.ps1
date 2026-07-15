$base = "http://localhost:3000"
$email = "auth.test.$(Get-Date -Format 'yyyyMMddHHmmss')@churcheden.test"
$password = "TestPass123"
$results = @()

function Test-Step($name, $script) {
    Write-Host "`n=== $name ===" -ForegroundColor Cyan
    try {
        $out = & $script
        Write-Host ($out | ConvertTo-Json -Depth 6 -Compress)
        $script:results += [pscustomobject]@{ step = $name; status = "PASS" }
        return $out
    } catch {
        $msg = $_.ErrorDetails.Message
        if (-not $msg) { $msg = $_.Exception.Message }
        Write-Host $msg -ForegroundColor Red
        $script:results += [pscustomobject]@{ step = $name; status = "FAIL"; error = $msg }
        return $null
    }
}

Test-Step "Health" { Invoke-RestMethod -Uri "$base/health" -Method GET -TimeoutSec 30 }

$reg = Test-Step "Register" {
    Invoke-RestMethod -Uri "$base/api/v1/auth/register" -Method POST -ContentType "application/json" -Body (@{ email = $email; password = $password } | ConvertTo-Json) -TimeoutSec 60
}

$accessToken = $reg.accessToken
$refreshToken = $reg.refreshToken

Test-Step "Login before verify (expect 403)" {
    try {
        Invoke-RestMethod -Uri "$base/api/v1/auth/login" -Method POST -ContentType "application/json" -Body (@{ email = $email; password = $password } | ConvertTo-Json) -TimeoutSec 30
        throw "Expected EMAIL_NOT_VERIFIED"
    } catch {
        if ($_.ErrorDetails.Message -match "EMAIL_NOT_VERIFIED|verify") { return @{ expected = "EMAIL_NOT_VERIFIED" } }
        throw
    }
}

# Pull OTP from DB via prisma is not available in ps1 — use resend with token for verify test path
Test-Step "Get current user with token" {
    Invoke-RestMethod -Uri "$base/api/v1/auth/me" -Method GET -Headers @{ Authorization = "Bearer $accessToken" } -TimeoutSec 30
}

Test-Step "Refresh token" {
    Invoke-RestMethod -Uri "$base/api/v1/auth/refresh" -Method POST -ContentType "application/json" -Body (@{ refreshToken = $refreshToken } | ConvertTo-Json) -TimeoutSec 30
}

Test-Step "Google auth URL" {
    Invoke-RestMethod -Uri "$base/api/v1/auth/google/url" -Method GET -TimeoutSec 30
}

Test-Step "Forgot password" {
    Invoke-RestMethod -Uri "$base/api/v1/auth/forgot-password" -Method POST -ContentType "application/json" -Body (@{ email = $email } | ConvertTo-Json) -TimeoutSec 30
}

Test-Step "Logout" {
    Invoke-RestMethod -Uri "$base/api/v1/auth/logout" -Method POST -Headers @{ Authorization = "Bearer $accessToken" } -TimeoutSec 30
}

Write-Host "`n=== SUMMARY ===" -ForegroundColor Green
$results | Format-Table -AutoSize
