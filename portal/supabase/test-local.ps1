param([switch]$ApplyMigration)
$ErrorActionPreference = 'Stop'
$container = 'legalty-profiles-sql-test'
$context = 'desktop-linux'
$state = & docker --context $context inspect $container --format '{{json .HostConfig.PortBindings}}|{{.HostConfig.NetworkMode}}|{{.State.Running}}'
if ($LASTEXITCODE -ne 0 -or $state -ne '{}|none|true') {
    throw 'The dedicated SQL container must be running without networking or host ports.'
}

function Invoke-LocalSql([string]$Path) {
    Get-Content -LiteralPath $Path -Raw -Encoding UTF8 |
        & docker --context $context exec -i $container psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -At
    if ($LASTEXITCODE -ne 0) { throw 'Local SQL execution failed.' }
}

if ($ApplyMigration) {
    Invoke-LocalSql (Join-Path $PSScriptRoot 'migrations/202609260001_trusted_profiles.sql')
}
$output = @(Invoke-LocalSql (Join-Path $PSScriptRoot 'tests/profiles.test.sql'))
$output | Write-Output
if ($output -match '^not ok' -or -not ($output -match '^1\.\.[1-9][0-9]*$')) {
    throw 'pgTAP assertions failed or the final plan is missing.'
}
