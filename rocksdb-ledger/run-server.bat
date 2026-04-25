@echo off
setlocal enabledelayedexpansion
echo ========================================
echo RocksDB Ledger Server Startup Script
echo ========================================
echo.
cd /d "%~dp0"
echo Current directory: %cd%
echo.
echo Node executable check:
where node
echo.
echo Starting server...
echo.
node server.js
if errorlevel 1 (
    echo.
    echo ERROR: Server failed to start!
    pause
    exit /b 1
)
