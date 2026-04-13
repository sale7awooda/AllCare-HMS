@echo off
cd /d "%~dp0"
echo Starting AllCare HMS Server...
if not exist ".env" (
    echo WARNING: .env file not found. Using built-in defaults.
    echo Run windows_deploy.bat first to set up your environment correctly.
)
npm run start
