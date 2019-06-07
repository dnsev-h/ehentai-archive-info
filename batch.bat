@echo off

set SCRIPT_DIR=%~dp0

node "%SCRIPT_DIR%src/main.js" %* || goto :error

pause
goto :eof


:error
pause
goto :eof
