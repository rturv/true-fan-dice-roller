# Arranca el backend en modo dev contra la base de datos PostgreSQL de Neon.
# Los secretos viven en .env.neon.local (ignorado por git).
$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot '.env.neon.local'
if (-not (Test-Path $envFile)) {
    Write-Error "No existe $envFile. Crea el fichero con DB_URL, DB_USER, DB_PASSWORD y JWT_SECRET."
    exit 1
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        $idx = $line.IndexOf('=')
        if ($idx -gt 0) {
            $name = $line.Substring(0, $idx).Trim()
            $value = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
}

$env:QUARKUS_PROFILE = 'prod'

# El sistema tiene JAVA_HOME apuntando a JDK 8; Maven/Quarkus requieren JDK 25.
# Se puede sobreescribir con DICEROLLER_JAVA_HOME.
$env:JAVA_HOME = if ($env:DICEROLLER_JAVA_HOME) { $env:DICEROLLER_JAVA_HOME } else { 'C:\programas\jdk-25.0.2' }

Write-Host "Arrancando Quarkus con perfil prod contra Neon (JAVA_HOME=$env:JAVA_HOME)..."
& (Join-Path $PSScriptRoot 'mvnw.cmd') quarkus:dev
