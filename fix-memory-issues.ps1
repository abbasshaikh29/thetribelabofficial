# PowerShell script to fix Node.js memory issues
# Run this script when you encounter memory errors

Write-Host "🔧 Fixing Node.js Memory Issues..." -ForegroundColor Cyan

# Step 1: Clean build artifacts
Write-Host "📁 Cleaning build artifacts..." -ForegroundColor Yellow
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "node_modules/.cache" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "tsconfig.tsbuildinfo" -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✅ Build artifacts cleaned" -ForegroundColor Green

# Step 2: Clear npm cache
Write-Host "🗑️ Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force
Write-Host "✅ npm cache cleared" -ForegroundColor Green

# Step 3: Check available memory
Write-Host "💾 Checking system memory..." -ForegroundColor Yellow
$memory = Get-WmiObject -Class Win32_OperatingSystem
$totalMemory = [math]::Round($memory.TotalVisibleMemorySize / 1MB, 2)
$freeMemory = [math]::Round($memory.FreePhysicalMemory / 1MB, 2)
Write-Host "Total Memory: $totalMemory GB" -ForegroundColor Cyan
Write-Host "Free Memory: $freeMemory GB" -ForegroundColor Cyan

# Step 4: Kill any hanging Node processes
Write-Host "🔄 Killing hanging Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "next" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "✅ Node.js processes cleaned" -ForegroundColor Green

# Step 5: Provide recommendations
Write-Host "📋 Memory Optimization Recommendations:" -ForegroundColor Magenta
Write-Host "1. Use 'npm run dev' (now includes memory optimization)" -ForegroundColor White
Write-Host "2. Close unnecessary applications to free up RAM" -ForegroundColor White
Write-Host "3. Consider using 'npm run build:skip-types' for faster builds" -ForegroundColor White
Write-Host "4. If issues persist, restart your computer" -ForegroundColor White

Write-Host "🎉 Memory optimization complete!" -ForegroundColor Green
Write-Host "You can now run 'npm run dev' to start development" -ForegroundColor Cyan
