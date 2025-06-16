@echo off
echo 🔧 Starting Memory Cleanup...

echo 🔪 Killing Node.js processes...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im next.exe >nul 2>&1
taskkill /f /im npm.exe >nul 2>&1
echo ✅ Node processes killed

echo 🧹 Cleaning build artifacts...
if exist .next rmdir /s /q .next >nul 2>&1
if exist node_modules\.cache rmdir /s /q node_modules\.cache >nul 2>&1
if exist tsconfig.tsbuildinfo del /q tsconfig.tsbuildinfo >nul 2>&1
if exist .turbo rmdir /s /q .turbo >nul 2>&1
echo ✅ Build artifacts cleaned

echo 🗑️ Clearing npm cache...
npm cache clean --force >nul 2>&1
echo ✅ npm cache cleared

echo 🎉 Memory cleanup completed!
echo.
echo You can now run: npm run dev
pause
