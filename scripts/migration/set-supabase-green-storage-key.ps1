$ErrorActionPreference = "Stop"

if (-not $env:LOCALAPPDATA) {
  throw "LOCALAPPDATA is unavailable for a current-user protected key."
}

$credentialDirectory = Join-Path $env:LOCALAPPDATA "Codex\migrations\interprete-supabase"
$credentialFile = Join-Path $credentialDirectory "green-storage-secret-key.dpapi"
if (Test-Path -LiteralPath $credentialFile) {
  throw "A protected green Storage key already exists; do not overwrite it silently."
}

$secureKey = Read-Host -Prompt "Cole a Secret API key do projeto green qffqhilydtnrggbcnogh" -AsSecureString
$bstr = [IntPtr]::Zero
$plainKey = $null
$temporaryFile = $null

try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if (-not $plainKey.StartsWith("sb_secret_", [StringComparison]::Ordinal)) {
    throw "invalid-key"
  }

  [void][IO.Directory]::CreateDirectory($credentialDirectory)
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  & icacls.exe $credentialDirectory /inheritance:r /grant:r "*$($sid):(OI)(CI)(F)" *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Could not restrict the credential directory to the current Windows user."
  }

  Add-Type -AssemblyName System.Security
  $plainBytes = [Text.Encoding]::UTF8.GetBytes($plainKey)
  $protectedBytes = [Security.Cryptography.ProtectedData]::Protect(
    $plainBytes,
    $null,
    [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  [Array]::Clear($plainBytes, 0, $plainBytes.Length)

  $temporaryFile = Join-Path $credentialDirectory (".green-storage-key-" + [Guid]::NewGuid().ToString("N"))
  [IO.File]::WriteAllBytes($temporaryFile, $protectedBytes)
  & icacls.exe $temporaryFile /inheritance:r /grant:r "*$($sid):(F)" *> $null
  if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $temporaryFile -Force -ErrorAction SilentlyContinue
    throw "Could not restrict the protected key file to the current Windows user."
  }

  [IO.File]::Move($temporaryFile, $credentialFile)
  $temporaryFile = $null
  Write-Host "Secret API key protegida com DPAPI CurrentUser fora do checkout. O valor não foi exibido."
} catch {
  if ($_.Exception.Message -eq "invalid-key") {
    throw "Use a Secret API key do projeto green, com prefixo sb_secret_. Não use publishable/anon key."
  }
  throw "Não foi possível armazenar a chave protegida. O valor não foi exibido; verifique o perfil Windows e tente novamente."
} finally {
  if ($temporaryFile -and (Test-Path -LiteralPath $temporaryFile)) {
    Remove-Item -LiteralPath $temporaryFile -Force -ErrorAction SilentlyContinue
  }
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  if ($secureKey) {
    $secureKey.Dispose()
  }
  $plainKey = $null
}
