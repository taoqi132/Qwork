@echo off
setlocal EnableExtensions DisableDelayedExpansion
pushd "%~dp0"
if errorlevel 1 exit /b 1
if /i "%~1"=="--portable" goto portable
if /i "%~1"=="--help" goto help
if not "%~1"=="" if /i not "%~1"=="--check" goto help
echo Qwork - Multi-Agent Collaboration Workspace
where node.exe >nul 2>nul
if errorlevel 1 goto no_node
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=12)?0:1)"
if errorlevel 1 goto no_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto no_npm
if /i "%~1"=="--check" goto checked
if not exist "node_modules\electron\cli.js" goto install
if not exist "node_modules\vite\package.json" goto install
goto build
:install
echo [1/3] Installing locked dependencies. Internet access is required.
call npm.cmd ci
if errorlevel 1 goto failed
:build
echo [2/3] Building the current source...
node scripts\build.mjs
if errorlevel 1 goto failed
echo [3/3] Opening Qwork. Keep this console open while Qwork runs.
set "ELECTRON_RUN_AS_NODE="
node node_modules\electron\cli.js .
if errorlevel 1 goto failed
popd
exit /b 0
:checked
echo Node.js and npm are available.
node --version
if exist "node_modules\electron\cli.js" (echo Source dependencies: present.) else (echo Source dependencies: will be installed on first launch.)
if exist "release\win-unpacked\Qwork.exe" (echo Portable build: present.) else (echo Portable build: not present. Source launch is available.)
echo Agent CLI installation and sign-in are checked inside Qwork Settings.
popd
exit /b 0
:portable
if not exist "release\win-unpacked\Qwork.exe" goto no_portable
start "" "%~dp0release\win-unpacked\Qwork.exe"
popd
exit /b 0
:no_node
echo Node.js 22.12 or newer is required for source launch.
echo Install Node.js and reopen this script, or use Start-Qwork.bat --portable.
goto failed
:no_npm
echo npm.cmd was not found. Install Node.js with npm and reopen this script.
goto failed
:no_portable
echo Portable build not found. Keep the entire release\win-unpacked folder.
goto failed
:help
echo Usage: Start-Qwork.bat [--portable ^| --check ^| --help]
echo Default: install missing dependencies, rebuild current source, and launch.
echo --portable: launch release\win-unpacked\Qwork.exe without rebuilding.
echo --check: check prerequisites without launching or installing.
popd
exit /b 0
:failed
echo Qwork could not start. Read the error above before closing this window.
if /i not "%~1"=="--check" pause
popd
exit /b 1
