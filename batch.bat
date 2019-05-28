@echo off

set SCRIPT_DIR=%~dp0

for %%f in (%*) do call :convert %%f

color a
pause
color
goto :eof


:convert

set INPUT="%~1"

echo Processing %~nx1...
node "%SCRIPT_DIR%src/main.js" %INPUT%
echo.

:: Timeout to prevent loading pages too quickly
timeout 1 /NOBREAK > NUL 2> NUL

goto :eof
