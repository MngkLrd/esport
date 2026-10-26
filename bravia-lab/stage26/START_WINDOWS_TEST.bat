@echo off
chcp 65001 > nul
cd /d "%~dp0"
py -3 source\run_windows.py
if errorlevel 1 echo Test was not completed; no firmware was installed.
pause
