@echo off
echo Starting RocksDB Ledger Server...
cd /d %~dp0
node server.js
pause
