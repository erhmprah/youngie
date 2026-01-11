@echo off
echo Starting Youngie in development mode for WebRTC video chat...
echo ================================================================

REM Check if expo is installed
where expo >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Expo CLI is not installed. Please install it with: npm install -g @expo/cli
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

echo.
echo Starting development server...
echo Note: Video chat requires development mode to work properly.
echo.
echo Available commands:
echo   npm start     - Start development server
echo   npm run android - Run on Android device/emulator
echo   npm run ios     - Run on iOS simulator/device
echo.
echo Press Ctrl+C to stop the development server.
echo ================================================================

REM Start the development server
expo start