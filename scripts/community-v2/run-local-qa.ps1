param(
  [ValidateSet("full", "admin-recovery", "admin-pin", "member-recovery")]
  [string]$Suite = "full",
  [string]$RunId
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$expectedBranch = "codex/comunidade-v2"
$branch = (git -C $repoRoot branch --show-current).Trim()
if ($branch -ne $expectedBranch) {
  throw "Community V2 QA is restricted to branch $expectedBranch."
}

$qaRoot = Join-Path $env:LOCALAPPDATA "Codex\qa\community-v2-foundation-20261015"
$configPath = Join-Path $qaRoot "connection.dpapi"
$ledgerPath = Join-Path $qaRoot "clerk-qa-ledger.json"
$psqlPath = "C:\Users\gabsc\AppData\Local\Temp\interprete-pgtools-17.11-5\full-extract\bin\psql.exe"
if (!(Test-Path -LiteralPath $configPath) -or !(Test-Path -LiteralPath $ledgerPath)) {
  throw "The protected local QA configuration or existing Clerk QA ledger is unavailable."
}
if (!(Test-Path -LiteralPath $psqlPath)) {
  throw "The local psql binary is unavailable."
}

$configBytes = [IO.File]::ReadAllBytes($configPath)
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
$configPlain = [Security.Cryptography.ProtectedData]::Unprotect(
  $configBytes,
  $null,
  [Security.Cryptography.DataProtectionScope]::CurrentUser
)
$config = [Text.Encoding]::UTF8.GetString($configPlain) | ConvertFrom-Json
$ledger = Get-Content -LiteralPath $ledgerPath -Raw | ConvertFrom-Json
$runIdPattern = '^[0-9]{8}-[0-9]{6}-[a-f0-9]{8}$'
if (
  ($Suite -ne "full" -and !$RunId) -or
  ($RunId -and $RunId -notmatch $runIdPattern)
) {
  throw "Recovery-only runs require a valid existing local QA run ID."
}
if (
  $config.host -ne "127.0.0.1" -or
  [int]$config.port -ne 54325 -or
  $config.database -ne "interprete_community_v2_qa" -or
  $config.user -ne "community_qa" -or
  !(Test-Path -LiteralPath $config.caPath)
) {
  throw "The decrypted QA target does not match the approved isolated local database."
}

$members = @($ledger.accounts | Where-Object role -eq "MEMBER")
$member = if ($members.Count -gt 1) { $members[1] } else { $members[0] }
$admin = $ledger.accounts | Where-Object role -eq "ADMIN" | Select-Object -First 1
if (!($member -and $admin -and $member.email -and $admin.email)) {
  throw "The existing Clerk Development member/admin identities are unavailable."
}

$authDirectory = Join-Path $qaRoot "playwright"
$outputDirectory = Join-Path $authDirectory ("results\" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $authDirectory, $outputDirectory | Out-Null

# Playwright storageState contains reusable Clerk session cookies. Keep it outside
# the repository and restrict its inherited Windows ACL to this user and SYSTEM.
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$currentUserSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$icacls = Join-Path $env:SystemRoot "System32\icacls.exe"
& $icacls $authDirectory /inheritance:r /grant:r "${currentUser}:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" /T /Q | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Could not restrict access to the local Clerk storageState directory."
}
# Playwright creates the member/admin state files under this protected directory.

$savedEnvironment = @{}
$environmentNames = @(
  "COMMUNITY_QA_ISOLATED",
  "COMMUNITY_QA_EXPECTED_DATABASE",
  "COMMUNITY_QA_LEDGER_PATH",
  "COMMUNITY_QA_AUTH_DIR",
  "COMMUNITY_QA_OUTPUT_DIR",
  "COMMUNITY_QA_RUN_ID",
  "COMMUNITY_QA_MEMBER_EMAIL",
  "COMMUNITY_QA_ADMIN_EMAIL",
  "COMMUNITY_POST_COVER_ALT_ENABLED",
  "APP_WRITE_FREEZE",
  "SEED_DEVELOPMENT_DATA",
  "GESTAO_DEV_AUTH",
  "NEXT_PUBLIC_GESTAO_DEV_AUTH",
  "CLERK_PROXY_URL",
  "NEXT_PUBLIC_CLERK_PROXY_URL",
  "CLERK_FAPI",
  "NEXT_PUBLIC_CLERK_FAPI",
  "NEXT_PUBLIC_APP_URL",
  "DATABASE_URL",
  "DIRECT_URL",
  "DATABASE_CA_CERT",
  "DATABASE_CA_CERT_PATH",
  "PGHOST",
  "PGPORT",
  "PGUSER",
  "PGDATABASE",
  "PGPASSWORD",
  "PGSSLMODE",
  "PGSSLROOTCERT",
  "NODE_USE_SYSTEM_CA"
)
foreach ($name in $environmentNames) {
  $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

try {
  $escapedUser = [uri]::EscapeDataString([string]$config.user)
  $escapedPassword = [uri]::EscapeDataString([string]$config.password)
  $databaseUrl = "postgresql://${escapedUser}:${escapedPassword}@127.0.0.1:54325/interprete_community_v2_qa?connection_limit=3&pgbouncer=true"
  $directUrl = "postgresql://${escapedUser}:${escapedPassword}@127.0.0.1:54325/interprete_community_v2_qa?connection_limit=3"
  $runId = $RunId
  if (!$runId) {
    $runId = Get-Date -Format "yyyyMMdd-HHmmss"
    $runId = "$runId-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
  }

  $env:COMMUNITY_QA_ISOLATED = "true"
  $env:COMMUNITY_QA_EXPECTED_DATABASE = "interprete_community_v2_qa"
  $env:COMMUNITY_QA_LEDGER_PATH = $ledgerPath
  $env:COMMUNITY_QA_AUTH_DIR = $authDirectory
  $env:COMMUNITY_QA_OUTPUT_DIR = $outputDirectory
  $env:COMMUNITY_QA_RUN_ID = $runId
  $env:COMMUNITY_QA_MEMBER_EMAIL = [string]$member.email
  $env:COMMUNITY_QA_ADMIN_EMAIL = [string]$admin.email
  $env:COMMUNITY_POST_COVER_ALT_ENABLED = "true"
  $env:APP_WRITE_FREEZE = "false"
  $env:SEED_DEVELOPMENT_DATA = "false"
  $env:GESTAO_DEV_AUTH = "false"
  $env:NEXT_PUBLIC_GESTAO_DEV_AUTH = "false"
  $env:CLERK_PROXY_URL = ""
  $env:NEXT_PUBLIC_CLERK_PROXY_URL = ""
  $env:CLERK_FAPI = ""
  $env:NEXT_PUBLIC_CLERK_FAPI = ""
  $env:NEXT_PUBLIC_APP_URL = "http://localhost:3101"
  $env:DATABASE_URL = $databaseUrl
  $env:DIRECT_URL = $directUrl
  $env:DATABASE_CA_CERT = ""
  $env:DATABASE_CA_CERT_PATH = [string]$config.caPath
  $env:PGHOST = "127.0.0.1"
  $env:PGPORT = "54325"
  $env:PGUSER = [string]$config.user
  $env:PGDATABASE = [string]$config.database
  $env:PGPASSWORD = [string]$config.password
  $env:PGSSLMODE = "verify-full"
  $env:PGSSLROOTCERT = [string]$config.caPath
  $env:NODE_USE_SYSTEM_CA = "1"

  & $psqlPath -X -v ON_ERROR_STOP=1 -c "SELECT current_database() = 'interprete_community_v2_qa' AS isolated_target_ok;" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "The guarded local QA database is not accepting verified TLS connections."
  }

  Push-Location (Join-Path $repoRoot "apps\app")
  try {
    bun run community-v2:qa:prepare
    if ($LASTEXITCODE -ne 0) {
      throw "Local QA identity preparation failed."
    }
    if ($Suite -eq "full") {
      bun run community-v2:e2e
    } else {
      $project = if ($Suite -eq "admin-recovery" -or $Suite -eq "admin-pin") {
        "community-admin-recovery"
      } else {
        "community-member-recovery"
      }
      $authProjects = @(
        "--project=clerk-setup",
        "--project=member-auth",
        "--project=admin-auth"
      )
      $authProjects += "--project=$project"
      $authProjects += "--no-deps"
      if ($Suite -eq "admin-pin") {
        $authProjects += "--grep=initialize Clerk Testing token|reuse or initialize the existing Clerk Development .* session|concurrent staff pin requests"
      }
      bun run community-v2:e2e @authProjects
    }
    if ($LASTEXITCODE -ne 0) {
      throw "The Community V2 local Playwright journey failed."
    }
    if ($Suite -ne "full") {
      Write-Output "Community V2 authentication state was reused or refreshed before the isolated recovery journey."
    }
  } finally {
    Pop-Location
  }

  Write-Output "Community V2 local QA artifacts: $outputDirectory"
} finally {
  if (Test-Path -LiteralPath $outputDirectory) {
    $artifactEntries = @((Get-Item -LiteralPath $outputDirectory)) + @(
      Get-ChildItem -LiteralPath $outputDirectory -Force -Recurse
    )
    foreach ($artifactEntry in $artifactEntries) {
      & $icacls $artifactEntry.FullName /inheritance:r /grant:r "*${currentUserSid}:F" "*S-1-5-18:F" /Q | Out-Null
      if ($LASTEXITCODE -ne 0) {
        throw "Could not restrict access to the local Community V2 QA artifacts."
      }
    }
  }
  foreach ($name in $environmentNames) {
    [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], "Process")
  }
}
