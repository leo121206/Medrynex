@echo off
title Medrynx EHR - Initial Setup
echo =================================================================
echo   MEDRYNX (MEDIVAULT) - DEPENDENCY INSTALLER
echo =================================================================
echo.

set ROOT_DIR=%~dp0

echo [1/4] Installing Smart Contract dependencies...
cd /d "%ROOT_DIR%contracts"
call npm install

echo.
echo [2/4] Installing AI/ML Microservice Python dependencies...
cd /d "%ROOT_DIR%aiml"
pip install -r requirements.txt

echo.
echo [3/4] Installing Backend API Server dependencies...
cd /d "%ROOT_DIR%backend"
call npm install

echo.
echo [4/4] Installing Frontend Portal dependencies...
cd /d "%ROOT_DIR%frontend"
call npm install

echo.
echo =================================================================
echo   ALL DEPENDENCIES INSTALLED SUCCESSFULLY!
echo =================================================================
echo.
echo You can now run "start_all.bat" to start all 5 services.
echo.
pause
