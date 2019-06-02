@echo off

set SCRIPT_DIR=%~dp0

for %%f in (%*) do call :convert %%f

color a
pause
color
goto :eof


:convert

set INPUT="%~1"

echo Processing "%~nx1"...
node "%SCRIPT_DIR%src/main.js" %INPUT%
echo.

goto :eof
