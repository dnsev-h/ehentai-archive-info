@echo off

set SCRIPT_DIR=%~dp0

for %%f in (%*) do (
	set INPUT=%%f
	call :convert
)

color a
pause
color
goto :eof


:convert

node "%SCRIPT_DIR%src/main.js" %INPUT%
echo.

goto :eof
