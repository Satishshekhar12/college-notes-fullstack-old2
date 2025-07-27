@echo off
echo Starting College Notes Enhanced Features Test...
echo.

echo 1. Starting server...
cd /d "d:\codings\reactjs\College-Notes\server"
start "Server" cmd /k "node server.js"

echo 2. Waiting for server to start...
timeout /t 5 /nobreak > nul

echo 3. Starting client...
cd /d "d:\codings\reactjs\College-Notes\client"
start "Client" cmd /k "npm run dev"

echo.
echo ✅ Both server and client should be starting...
echo 📋 Check the admin panel at http://localhost:5173/admin
echo 🔍 Look for enhanced user statistics in the pending uploads section
echo.
pause
