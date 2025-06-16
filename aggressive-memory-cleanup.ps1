# Aggressive Memory Cleanup Script
# Run this when you have severe memory issues

Write-Host "🚀 Starting Aggressive Memory Cleanup..." -ForegroundColor Red

# Step 1: Kill all Node.js and related processes
Write-Host "🔪 Killing all Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "*node*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "*next*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "*npm*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "*yarn*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "*pnpm*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "✅ All Node.js processes terminated" -ForegroundColor Green

# Step 2: Clean all build artifacts and caches
Write-Host "🧹 Deep cleaning build artifacts..." -ForegroundColor Yellow
$pathsToClean = @(
    ".next",
    "node_modules\.cache",
    "tsconfig.tsbuildinfo",
    ".turbo",
    "dist",
    "build",
    ".webpack",
    ".parcel-cache",
    ".vite"
)

foreach ($path in $pathsToClean) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  Removed: $path" -ForegroundColor Gray
    }
}
Write-Host "✅ Build artifacts cleaned" -ForegroundColor Green

# Step 3: Clear all package manager caches
Write-Host "🗑️ Clearing package manager caches..." -ForegroundColor Yellow
npm cache clean --force 2>$null
yarn cache clean --force 2>$null
pnpm store prune 2>$null
Write-Host "✅ Package caches cleared" -ForegroundColor Green

# Step 4: Force garbage collection
Write-Host "♻️ Forcing garbage collection..." -ForegroundColor Yellow
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()
[System.GC]::Collect()
Write-Host "✅ Garbage collection completed" -ForegroundColor Green

# Step 5: Clear Windows temp files
Write-Host "🧽 Clearing Windows temp files..." -ForegroundColor Yellow
$tempPaths = @(
    $env:TEMP,
    "$env:LOCALAPPDATA\Temp",
    "$env:WINDIR\Temp"
)

foreach ($tempPath in $tempPaths) {
    if (Test-Path $tempPath) {
        Get-ChildItem -Path $tempPath -Recurse -Force -ErrorAction SilentlyContinue | 
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "✅ Temp files cleared" -ForegroundColor Green

# Step 6: Check memory after cleanup
Write-Host "📊 Checking memory after cleanup..." -ForegroundColor Cyan
$memory = Get-WmiObject -Class Win32_OperatingSystem
$totalMemory = [math]::Round($memory.TotalVisibleMemorySize / 1MB, 2)
$freeMemory = [math]::Round($memory.FreePhysicalMemory / 1MB, 2)
$usedMemory = $totalMemory - $freeMemory
$memoryUsagePercent = [math]::Round(($usedMemory / $totalMemory) * 100, 1)

Write-Host "Total Memory: $totalMemory GB" -ForegroundColor White
Write-Host "Free Memory: $freeMemory GB" -ForegroundColor Green
Write-Host "Used Memory: $usedMemory GB ($memoryUsagePercent%)" -ForegroundColor $(if ($memoryUsagePercent -gt 80) { "Red" } else { "Yellow" })

# Step 7: Recommendations
Write-Host "`n🎯 Next Steps:" -ForegroundColor Magenta
if ($freeMemory -lt 2) {
    Write-Host "⚠️  WARNING: Still low on memory ($freeMemory GB free)" -ForegroundColor Red
    Write-Host "   Consider closing other applications or restarting your computer" -ForegroundColor Yellow
} else {
    Write-Host "✅ Memory looks good ($freeMemory GB free)" -ForegroundColor Green
}

Write-Host "`n🚀 You can now try running:" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor White
Write-Host "`n💡 If issues persist, try:" -ForegroundColor Cyan
Write-Host "   1. Restart your computer" -ForegroundColor White
Write-Host "   2. Close browser tabs and other applications" -ForegroundColor White
Write-Host "   3. Use npm run build:skip-types for faster builds" -ForegroundColor White

Write-Host "`n🎉 Aggressive cleanup completed!" -ForegroundColor Green
