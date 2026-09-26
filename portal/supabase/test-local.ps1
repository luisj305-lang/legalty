param([switch]$ApplyMigration, [switch]$ApplyCases, [switch]$ApplyWrites,
    [switch]$ApplyMfaPolicy, [switch]$ApplyUpdateLockOrder,
    [string]$Container = 'legalty-profiles-sql-test')
$ErrorActionPreference = 'Stop'
$container = $Container
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
if ($ApplyCases) {
    Invoke-LocalSql (Join-Path $PSScriptRoot 'migrations/202609260002_case_reads.sql')
}
if ($ApplyWrites) {
    Invoke-LocalSql (Join-Path $PSScriptRoot 'migrations/202609260003_case_writes.sql')
}
if ($ApplyMfaPolicy) {
    Invoke-LocalSql (Join-Path $PSScriptRoot 'migrations/202609260004_temporarily_allow_aal1.sql')
}
if ($ApplyUpdateLockOrder) {
    Invoke-LocalSql (Join-Path $PSScriptRoot 'migrations/202609260005_update_case_lock_order.sql')
}
foreach ($test in Get-ChildItem (Join-Path $PSScriptRoot 'tests') -Filter '*.test.sql' | Sort-Object Name) {
    $output = @(Invoke-LocalSql $test.FullName)
    $output | Write-Output
    if ($output -match '^not ok' -or -not ($output -match '^1\.\.[1-9][0-9]*$')) {
        throw 'pgTAP assertions failed or the final plan is missing.'
    }
}
