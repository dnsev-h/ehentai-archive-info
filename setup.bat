@echo off
pushd "%~dp0"
call npm install || goto :error
popd
color a
echo Setup successful!
pause
color
goto :eof

:error
color c
echo.
echo npm failed to run
echo Install node and npm from https://nodejs.org/
pause
color
goto :eof
