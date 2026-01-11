#!/bin/bash

echo "Starting Youngie in development mode for WebRTC video chat..."
echo "=================================================="

# Check if expo is installed
if ! command -v expo &> /dev/null; then
    echo "Error: Expo CLI is not installed. Please install it with: npm install -g @expo/cli"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo ""
echo "Starting development server..."
echo "Note: Video chat requires development mode to work properly."
echo ""
echo "Available commands:"
echo "  npm start     - Start development server"
echo "  npm run android - Run on Android device/emulator"
echo "  npm run ios     - Run on iOS simulator/device"
echo ""
echo "Press Ctrl+C to stop the development server."
echo "=================================================="

# Start the development server
expo start