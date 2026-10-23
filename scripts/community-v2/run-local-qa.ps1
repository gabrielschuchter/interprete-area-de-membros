param(
  [ValidateSet("full", "admin-recovery", "admin-pin", "member-recovery", "storage-cover", "discussion", "groups", "invitations", "shares", "announcements", "goal", "visual")]
  [string]$Suite = "full",
  [string]$RunId,
  [string]$TestFilter
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
$psqlFallbackPath = "C:\Users\gabsc\AppData\Local\Temp\interprete-pgtools-17.11-5\full-runtime\pgsql\bin\psql.exe"
if (!(Test-Path -LiteralPath $psqlPath) -and (Test-Path -LiteralPath $psqlFallbackPath)) {
  $psqlPath = $psqlFallbackPath
}
if (!(Test-Path -LiteralPath $configPath) -or !(Test-Path -LiteralPath $ledgerPath)) {
  throw "The protected local QA configuration or existing Clerk QA ledger is unavailable."
}
if (!(Test-Path -LiteralPath $psqlPath)) {
  throw "The local psql binary is unavailable."
}

$configBytes = [IO.File]::ReadAllBytes($configPath)
$protectedDataAssembly = Join-Path $PSHOME "System.Security.Cryptography.ProtectedData.dll"
if (Test-Path -LiteralPath $protectedDataAssembly) {
  Add-Type -Path $protectedDataAssembly
} else {
  Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
}
$configPlain = [Security.Cryptography.ProtectedData]::Unprotect(
  $configBytes,
  $null,
  [Security.Cryptography.DataProtectionScope]::CurrentUser
)
$config = [Text.Encoding]::UTF8.GetString($configPlain) | ConvertFrom-Json
$ledger = Get-Content -LiteralPath $ledgerPath -Raw | ConvertFrom-Json
$runIdPattern = '^[0-9]{8}-[0-9]{6}-[a-f0-9]{8}$'
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
$secondaryMember = if ($members.Count -gt 1) { $members[0] } else { $null }
$admin = $ledger.accounts | Where-Object role -eq "ADMIN" | Select-Object -First 1
$teacher = $ledger.accounts | Where-Object role -eq "TEACHER" | Select-Object -First 1
if (!($member -and $admin -and $member.email -and $admin.email)) {
  throw "The existing Clerk Development member/admin identities are unavailable."
}
if ($Suite -in @("groups", "invitations", "shares", "announcements", "goal", "full") -and !($secondaryMember -and $teacher -and $secondaryMember.email -and $teacher.email)) {
  throw "The existing second MEMBER and TEACHER Clerk Development identities are required for group authorization QA."
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
$restoreNotificationBroadcastTrigger = $false
$notificationBroadcastTriggerOriginalState = $null
$notificationTriggerRestoreFailed = $false
$environmentNames = @(
  "COMMUNITY_QA_ISOLATED",
  "COMMUNITY_QA_SUITE",
  "COMMUNITY_QA_EXPECTED_DATABASE",
  "COMMUNITY_QA_LEDGER_PATH",
  "COMMUNITY_QA_AUTH_DIR",
  "COMMUNITY_QA_OUTPUT_DIR",
  "COMMUNITY_QA_RUN_ID",
  "COMMUNITY_QA_MEMBER_EMAIL",
  "COMMUNITY_QA_MEMBER_ID",
  "COMMUNITY_QA_ADMIN_EMAIL",
  "COMMUNITY_QA_ADMIN_ID",
  "COMMUNITY_QA_SECONDARY_MEMBER_EMAIL",
  "COMMUNITY_QA_SECONDARY_MEMBER_ID",
  "COMMUNITY_QA_TEACHER_EMAIL",
  "COMMUNITY_QA_TEACHER_ID",
  "COMMUNITY_POST_COVER_ALT_ENABLED",
  "APP_WRITE_FREEZE",
  "VERCEL_ENV",
  "OUTBOX_QUEUE_NAMESPACE",
  "OUTBOX_PREVIEW_MEMBER_IDS",
  "UPLOADS_PAUSED_FOR_ROLLBACK",
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
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "PGHOST",
  "PGPORT",
  "PGUSER",
  "PGDATABASE",
  "PGPASSWORD",
  "PGSSLMODE",
  "PGSSLROOTCERT",
  "NODE_USE_SYSTEM_CA"
)

$recoverySuites = @("admin-recovery", "admin-pin", "member-recovery")
if (($Suite -in $recoverySuites -and !$RunId) -or ($RunId -and $RunId -notmatch $runIdPattern)) {
  throw "Recovery-only runs require a valid existing local QA run ID."
}

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
  $env:COMMUNITY_QA_SUITE = $Suite
  $env:COMMUNITY_QA_EXPECTED_DATABASE = "interprete_community_v2_qa"
  $env:COMMUNITY_QA_LEDGER_PATH = $ledgerPath
  $env:COMMUNITY_QA_AUTH_DIR = $authDirectory
  $env:COMMUNITY_QA_OUTPUT_DIR = $outputDirectory
  $env:COMMUNITY_QA_RUN_ID = $runId
  $env:COMMUNITY_QA_MEMBER_EMAIL = [string]$member.email
  $env:COMMUNITY_QA_MEMBER_ID = [string]$member.clerkUserId
  $env:COMMUNITY_QA_ADMIN_EMAIL = [string]$admin.email
  $env:COMMUNITY_QA_ADMIN_ID = [string]$admin.clerkUserId
  $env:COMMUNITY_QA_SECONDARY_MEMBER_EMAIL = if ($secondaryMember) { [string]$secondaryMember.email } else { "" }
  $env:COMMUNITY_QA_SECONDARY_MEMBER_ID = if ($secondaryMember) { [string]$secondaryMember.clerkUserId } else { "" }
  $env:COMMUNITY_QA_TEACHER_EMAIL = if ($teacher) { [string]$teacher.email } else { "" }
  $env:COMMUNITY_QA_TEACHER_ID = if ($teacher) { [string]$teacher.clerkUserId } else { "" }
  $env:COMMUNITY_POST_COVER_ALT_ENABLED = "true"
  $env:APP_WRITE_FREEZE = "false"
  $previewMemberIds = @(
    $ledger.accounts |
      ForEach-Object { [string]$_.clerkUserId } |
      Where-Object { ![string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  if ($previewMemberIds.Count -lt 2) {
    throw "The local Preview outbox allowlist requires the existing Clerk Development QA accounts."
  }
  $env:VERCEL_ENV = "preview"
  $env:OUTBOX_QUEUE_NAMESPACE = "preview"
  $env:OUTBOX_PREVIEW_MEMBER_IDS = $previewMemberIds -join ","
  $env:UPLOADS_PAUSED_FOR_ROLLBACK = "false"
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

  if ($Suite -in @("storage-cover", "groups", "full")) {
    $supabaseProjectDirectory = Join-Path $env:LOCALAPPDATA "Codex\qa\community-v2-storage-qa-20261021\project"
    $supabaseConfigPath = Join-Path $supabaseProjectDirectory "supabase\config.toml"
    if (!(Test-Path -LiteralPath $supabaseConfigPath)) {
      throw "The isolated local Supabase project configuration is unavailable."
    }

    Push-Location $env:TEMP
    try {
      $supabaseStatusLines = & npm exec --yes --package=supabase@2.121.0 -- supabase status --workdir $supabaseProjectDirectory --output-format json
      if ($LASTEXITCODE -ne 0) {
        throw "The isolated local Supabase CLI status command failed."
      }
    } finally {
      Pop-Location
    }

    $supabaseStatus = ($supabaseStatusLines -join [Environment]::NewLine) | ConvertFrom-Json
    $supabaseDatabaseUrl = [uri]$supabaseStatus.DB_URL
    $supabaseApiUrl = [uri]$supabaseStatus.API_URL
    $projectIdMatches = Select-String `
      -LiteralPath $supabaseConfigPath `
      -Pattern '^project_id\s*=\s*"interprete-community-storage-qa-20261021"\s*$' `
      -Quiet
    if (
      !$projectIdMatches -or
      $supabaseApiUrl.Scheme -ne "http" -or
      $supabaseApiUrl.Host -ne "127.0.0.1" -or
      $supabaseApiUrl.Port -ne 54321 -or
      $supabaseDatabaseUrl.Host -ne "127.0.0.1" -or
      $supabaseDatabaseUrl.Port -ne 54322 -or
      $supabaseDatabaseUrl.AbsolutePath -ne "/postgres" -or
      [string]::IsNullOrWhiteSpace($supabaseStatus.SECRET_KEY) -or
      [string]::IsNullOrWhiteSpace($supabaseStatus.ANON_KEY)
    ) {
      throw "Supabase CLI status did not prove the expected isolated loopback project and local credentials."
    }

    $apiPortBindings = & docker port "supabase_kong_interprete-community-storage-qa-20261021" "8000/tcp"
    if ($LASTEXITCODE -ne 0) {
      throw "The isolated Supabase API container port binding could not be verified."
    }
    $databasePortBindings = & docker port "supabase_db_interprete-community-storage-qa-20261021" "5432/tcp"
    if ($LASTEXITCODE -ne 0) {
      throw "The isolated Supabase database port binding could not be verified."
    }
    $portBindings = @($apiPortBindings) + @($databasePortBindings)
    $nonLoopbackBindings = @(
      $portBindings | Where-Object {
        $_.Trim() -notmatch '^(127\.0\.0\.1|\[?::1\]?):\d+$'
      }
    )
    if ($portBindings.Count -lt 2 -or $nonLoopbackBindings.Count -gt 0) {
      throw "The isolated Supabase API and database ports must be published on loopback only."
    }

    $env:SUPABASE_URL = $supabaseStatus.API_URL
    $env:NEXT_PUBLIC_SUPABASE_URL = $supabaseStatus.API_URL
    $env:SUPABASE_SECRET_KEY = $supabaseStatus.SECRET_KEY
    $env:SUPABASE_SERVICE_ROLE_KEY = $supabaseStatus.SERVICE_ROLE_KEY
    $env:SUPABASE_PUBLISHABLE_KEY = $supabaseStatus.PUBLISHABLE_KEY
    $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $supabaseStatus.PUBLISHABLE_KEY
    $env:SUPABASE_ANON_KEY = $supabaseStatus.ANON_KEY
    $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $supabaseStatus.ANON_KEY
    $env:SUPABASE_STORAGE_BUCKET = "community-v2-cover-qa"

    $storageUrl = [uri]$env:SUPABASE_URL
    $publicStorageUrl = [uri]$env:NEXT_PUBLIC_SUPABASE_URL
    if (
      $storageUrl.Scheme -ne "http" -or
      $storageUrl.Host -ne "127.0.0.1" -or
      $storageUrl.Port -ne 54321 -or
      $publicStorageUrl.AbsoluteUri.TrimEnd("/") -ne $storageUrl.AbsoluteUri.TrimEnd("/") -or
      $env:SUPABASE_STORAGE_BUCKET -ne "community-v2-cover-qa" -or
      [string]::IsNullOrWhiteSpace($env:SUPABASE_SECRET_KEY) -or
      [string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SUPABASE_ANON_KEY)
    ) {
      throw "Storage cover QA requires the isolated loopback Supabase endpoint, local private bucket, and local credentials."
    }

    $bucketList = @(
      Invoke-RestMethod `
        -Uri "$($storageUrl.AbsoluteUri.TrimEnd('/'))/storage/v1/bucket" `
        -Headers @{
          apikey = $env:SUPABASE_SECRET_KEY
          Authorization = "Bearer $($env:SUPABASE_SECRET_KEY)"
        } `
        -Method Get `
        -TimeoutSec 15
    )
    $qaBucket = $bucketList | Where-Object { $_.id -eq "community-v2-cover-qa" } | Select-Object -First 1
    if (!$qaBucket -or $qaBucket.public -ne $false) {
      throw "Storage cover QA could not prove the configured bucket is private and local."
    }
    Write-Output "Isolated Supabase Storage preflight passed: loopback API, private QA bucket, local secret accepted."
  }

  & $psqlPath -X -v ON_ERROR_STOP=1 -c "SELECT current_database() = 'interprete_community_v2_qa' AS isolated_target_ok;" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "The guarded local QA database is not accepting verified TLS connections."
  }

  Push-Location (Join-Path $repoRoot "apps\app")
  try {
    if ($Suite -in @("invitations", "shares", "announcements", "goal", "full")) {
      Push-Location $repoRoot
      try {
        if ($Suite -eq "announcements") {
          $failedMigrationCount = & $psqlPath -X -v ON_ERROR_STOP=1 -At -c 'SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name = ''20261022140000_community_announcement_integration'' AND finished_at IS NULL AND rolled_back_at IS NULL;'
          if ($LASTEXITCODE -ne 0) {
            throw "Could not inspect the failed Stage 08 migration in the guarded local QA database."
          }
          if ([int]$failedMigrationCount -gt 0) {
            $partialState = & $psqlPath -X -v ON_ERROR_STOP=1 -At -F '|' -c @'
SELECT
  (SELECT count(*) FROM pg_enum WHERE enumtypid = '"AnnouncementAudience"'::regtype AND enumlabel = 'COHORT'),
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Announcement' AND column_name IN ('isImportant', 'version')),
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name IN ('announcementId', 'announcementVersion')),
  (SELECT count(*) FROM pg_class WHERE oid IN ('public."AnnouncementCohort"'::regclass, 'public."AnnouncementDismissal"'::regclass)),
  (SELECT count(*) FROM public."AnnouncementCohort"),
  (SELECT count(*) FROM public."AnnouncementDismissal"),
  (SELECT count(*) FROM pg_constraint WHERE conname IN ('Notification_announcementId_fkey', 'Notification_announcement_version_check'));
'@
            if (
              $LASTEXITCODE -ne 0 -or
              ($partialState -join "").Trim() -ne "1|2|2|2|0|0|0"
            ) {
              throw "The incomplete Stage 08 migration does not match the expected empty local additive state; no migration repair was attempted."
            }
            Push-Location (Join-Path $repoRoot "packages\database")
            try {
              bunx prisma migrate resolve --rolled-back 20261022140000_community_announcement_integration
              if ($LASTEXITCODE -ne 0) {
                throw "Could not mark the verified incomplete Stage 08 migration rolled back in the guarded local QA database."
              }
            } finally {
              Pop-Location
            }
            Write-Output "Recovered the verified, empty Stage 08 partial migration in the isolated local QA database."
          }
        }
        bun run migrate:deploy
        if ($LASTEXITCODE -ne 0) {
          throw "The additive Community V2 migration failed against the guarded local QA database."
        }
      } finally {
        Pop-Location
      }
    }
    if ($Suite -in @("invitations", "announcements", "full")) {
      $triggerStateLines = & $psqlPath -X -qAt -v ON_ERROR_STOP=1 -c 'SELECT tgenabled FROM pg_trigger WHERE tgrelid = ''public."Notification"''::regclass AND tgname = ''Notification_broadcast_invalidation'';'
      if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect the isolated local Notification broadcast trigger state."
      }
      $notificationBroadcastTriggerOriginalState = ($triggerStateLines -join "").Trim()
      if ($notificationBroadcastTriggerOriginalState -notin @("O", "D", "A", "R")) {
        throw "The isolated local Notification broadcast trigger is missing or has an unsupported state."
      }
      $restoreNotificationBroadcastTrigger = $true
    }
    bun run community-v2:qa:prepare
    if ($LASTEXITCODE -ne 0) {
      throw "Local QA identity preparation failed."
    }
    if ($Suite -eq "full") {
      bun run community-v2:e2e
    } else {
      $project = if ($Suite -eq "storage-cover") {
        "community-storage-cover"
      } elseif ($Suite -eq "discussion") {
        "community-discussion"
      } elseif ($Suite -eq "groups") {
        "community-groups"
      } elseif ($Suite -eq "invitations") {
        "community-invitations"
      } elseif ($Suite -eq "shares") {
        "community-shares"
      } elseif ($Suite -eq "announcements") {
        "community-announcements"
      } elseif ($Suite -eq "goal") {
        "community-goal"
      } elseif ($Suite -eq "visual") {
        "community-visual-audit"
      } elseif ($Suite -eq "admin-recovery" -or $Suite -eq "admin-pin") {
        "community-admin-recovery"
      } else {
        "community-member-recovery"
      }
      $authProjects = @()
      if ($Suite -in @("storage-cover", "visual")) {
        $authProjects += "--project=$project"
      } else {
        $authProjects = @(
          "--project=member-auth",
          "--project=secondary-member-auth",
          "--project=teacher-auth",
          "--project=admin-auth",
          "--project=$project",
          "--no-deps"
        )
      }
      if ($Suite -eq "admin-pin") {
        $authProjects += "--grep=reuse or initialize the existing Clerk Development .* session|concurrent staff pin requests"
      }
      if ($TestFilter) {
        $authProjects += "--grep=$TestFilter"
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
  if ($restoreNotificationBroadcastTrigger) {
    try {
      $restorePsqlPath = if (Test-Path -LiteralPath $psqlPath) {
        $psqlPath
      } elseif (Test-Path -LiteralPath $psqlFallbackPath) {
        $psqlFallbackPath
      } else {
        $null
      }
      if (!$restorePsqlPath) {
        $notificationTriggerRestoreFailed = $true
      }
      else {
        $triggerRestoreSql = switch ($notificationBroadcastTriggerOriginalState) {
          "O" { 'ALTER TABLE public."Notification" ENABLE TRIGGER "Notification_broadcast_invalidation";' }
          "D" { 'ALTER TABLE public."Notification" DISABLE TRIGGER "Notification_broadcast_invalidation";' }
          "A" { 'ALTER TABLE public."Notification" ENABLE ALWAYS TRIGGER "Notification_broadcast_invalidation";' }
          "R" { 'ALTER TABLE public."Notification" ENABLE REPLICA TRIGGER "Notification_broadcast_invalidation";' }
        }
        & $restorePsqlPath -X -v ON_ERROR_STOP=1 -c $triggerRestoreSql | Out-Null
        if ($LASTEXITCODE -ne 0) {
          $notificationTriggerRestoreFailed = $true
        }
        else {
          Write-Output "Restored the isolated local Notification broadcast trigger to its original state ($notificationBroadcastTriggerOriginalState)."
        }
      }
    } catch {
      $notificationTriggerRestoreFailed = $true
    }
  }
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
  if ($notificationTriggerRestoreFailed) {
    throw "The temporary local Notification broadcast trigger could not be restored."
  }
}
