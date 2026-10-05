param([switch]$ReplaceExisting)
$ErrorActionPreference = "Stop"
if (-not $env:LOCALAPPDATA) { throw "LOCALAPPDATA unavailable." }
$credentialDirectory = Join-Path $env:LOCALAPPDATA "Codex\migrations\interprete-supabase"
$credentialFile = Join-Path $credentialDirectory "green-session-pooler-uri.dpapi"
if ((Test-Path -LiteralPath $credentialFile) -and -not $ReplaceExisting) {
  throw "A green SQL credential exists; use -ReplaceExisting explicitly."
}
$securePassword = $null
$bstr = [IntPtr]::Zero
$plainPassword = $null
$plainUri = $null
$plainBytes = $null
$roundtripBytes = $null
$temporaryFile = $null
try {
  Write-Host "GREEN SESSION POOLER CREDENTIAL - MASKED INPUT ACTIVE"
  $securePassword = Read-Host -Prompt "Current green Database password (masked; password only, no URI)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ([string]::IsNullOrEmpty($plainPassword)) { throw "empty-password" }
  # Encode exactly once, treating the password solely as data.
  $encodedPassword = [Uri]::EscapeDataString($plainPassword)
  $plainUri = "postgresql://postgres.qffqhilydtnrggbcnogh:" + $encodedPassword + "@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
  $uri = [Uri]::new($plainUri)
  $parts = $uri.UserInfo.Split(':', 2)
  if ($parts.Length -ne 2 -or [Uri]::UnescapeDataString($parts[1]) -cne $plainPassword) { throw "encoding-roundtrip-failed" }
  [void][IO.Directory]::CreateDirectory($credentialDirectory)
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  & icacls.exe $credentialDirectory /inheritance:r /grant:r "*$($sid):(OI)(CI)(F)" *> $null
  if ($LASTEXITCODE -ne 0) { throw "directory-acl-failed" }
  Add-Type -AssemblyName System.Security
  $plainBytes = [Text.Encoding]::UTF8.GetBytes($plainUri)
  $protectedBytes = [Security.Cryptography.ProtectedData]::Protect($plainBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  $temporaryFile = Join-Path $credentialDirectory (".green-uri-" + [Guid]::NewGuid().ToString("N"))
  [IO.File]::WriteAllBytes($temporaryFile, $protectedBytes)
  & icacls.exe $temporaryFile /inheritance:r /grant:r "*$($sid):(F)" *> $null
  if ($LASTEXITCODE -ne 0) { throw "file-acl-failed" }
  # Validate encrypted bytes read back from disk, before atomic replacement.
  $roundtripBytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($temporaryFile), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  if ($roundtripBytes.Length -ne $plainBytes.Length) { throw "dpapi-roundtrip-failed" }
  for ($i = 0; $i -lt $plainBytes.Length; $i++) {
    if ($roundtripBytes[$i] -ne $plainBytes[$i]) { throw "dpapi-roundtrip-failed" }
  }
  # PowerShell converts $null to an empty string for this .NET string argument.
  # NullString supplies an actual null backup path, preserving atomic replacement.
  if (Test-Path -LiteralPath $credentialFile) { [IO.File]::Replace($temporaryFile, $credentialFile, [System.Management.Automation.Language.NullString]::Value) }
  else { [IO.File]::Move($temporaryFile, $credentialFile) }
  $temporaryFile = $null
  Write-Host "CREDENTIAL_STORED: encoding and DPAPI disk roundtrip validated; no secret displayed."
} catch {
  throw "Green SQL credential storage failed. No secret displayed; old credential preserved until atomic replacement."
} finally {
  if ($temporaryFile -and (Test-Path -LiteralPath $temporaryFile)) {
    Remove-Item -LiteralPath $temporaryFile -Force -ErrorAction SilentlyContinue
  }
  if ($plainBytes) { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }
  if ($roundtripBytes) { [Array]::Clear($roundtripBytes, 0, $roundtripBytes.Length) }
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ($securePassword) { $securePassword.Dispose() }
  $plainPassword = $null
  $encodedPassword = $null
  $plainUri = $null
  $parts = $null
  $uri = $null
}
