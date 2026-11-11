@echo off
cls
echo ============================================================
echo   ATLAS HELIOS PLATFORM - START SERVICES
echo ============================================================
echo.

:: Kill existing Node processes
echo Stopping existing services...
taskkill /F /IM node.exe /IM python.exe 2>nul

timeout /t 2 /nobreak >nul

:: Start Nexus Bridge in new window
echo Starting Nexus Bridge on port 5051...
start "Nexus Bridge" cmd /k "cd /d F:\Atlas Helios\atlas-helios-platform\atlas-helios-platform\nexus-bridge && python mock_nexus_bridge.py --port 5051"

timeout /t 3 /nobreak >nul

:: Start Backend in new window
echo Starting Backend API on port 5002...
start "Backend API" cmd /k "cd /d F:\Atlas Helios\atlas-helios-platform\atlas-helios-platform\backend && set PORT=5002 && set NEXUS_BRIDGE_URL=http://localhost:5051 && set ENABLE_NEXUS_COGNITIVE=true && set ENABLE_NOAA_WEATHER=true && npm start"

timeout /t 5 /nobreak >nul

:: Start Frontend in new window
echo Starting Frontend on port 3002...
start "Frontend" cmd /k "cd /d F:\Atlas Helios\atlas-helios-platform\atlas-helios-platform\frontend && set PORT=3002 && npm start"

echo.
echo ============================================================
echo   ALL SERVICES STARTED!
echo ============================================================
echo.
echo   URLs:
echo     Frontend:     http://localhost:3002
echo     Backend API:  http://localhost:5002
echo     Nexus Bridge: http://localhost:5051
echo.
echo   Press any key to exit this window...
echo   (Services will continue running in other windows)
echo ============================================================
pause >nul
