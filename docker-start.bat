@echo off
echo ============================================================
echo SCHEDULE CONTROL ^& PROJECT GOVERNANCE — DOCKER LAUNCHER
echo ============================================================
echo Checking Docker Desktop status...

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Desktop is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo.
echo Building and launching container...
docker compose up --build -d

echo.
echo ============================================================
echo Application is running!
echo Access the dashboard in your browser at:
echo   http://localhost:3001
echo ============================================================
echo.
pause
