@echo off

set SCRIPT_DIR=%~dp0

node "%SCRIPT_DIR%src/main.js" %* || goto :error

color a
pause
color
goto :eof


:error

color c
pause
color

goto :eof
