@echo off
title Medrynx EHR - Multi-Service Orchestrator
echo =================================================================
echo   MEDRYNX (MEDIVAULT) - ALL-IN-ONE SERVICE LAUNCHER
echo =================================================================
echo.

set ROOT_DIR=%~dp0

echo [1/5] Starting Embedded PostgreSQL Service (port 5432)...
start "Medrynx [1] - PostgreSQL Service (5432)" cmd /k "cd /d %ROOT_DIR%backend && npx tsx scripts/postgres_service.ts"

echo Waiting 3 seconds for PostgreSQL initialization...
timeout /t 3 /nobreak >nul

echo.
echo [2/5] Starting Contracts (Hardhat EVM Local Node on port 8545)...
start "Medrynx [2] - Hardhat EVM Node (8545)" cmd /k "cd /d %ROOT_DIR%contracts && npx hardhat node"

echo Waiting 4 seconds for Hardhat EVM initialization...
timeout /t 4 /nobreak >nul

echo Deploying Smart Contracts to Hardhat Node...
cd /d "%ROOT_DIR%contracts"
call npx hardhat run scripts/deploy.cjs --network localhost

echo.
echo [3/5] Starting AI/ML Microservice (FastAPI on port 8000)...
start "Medrynx [3] - AI/ML Microservice (8000)" cmd /k "cd /d %ROOT_DIR%aiml && python -m uvicorn api.main:app --host 127.0.0.1 --port 8000"

echo.
echo [4/5] Starting Backend API Server (Node/Express on port 5000)...
start "Medrynx [4] - Backend API (5000)" cmd /k "cd /d %ROOT_DIR%backend && npm run dev"

echo.
echo [5/5] Starting Frontend Portal (Vite React on port 5173)...
start "Medrynx [5] - Frontend Portal (5173)" cmd /k "cd /d %ROOT_DIR%frontend && npm run dev"

echo.
echo =================================================================
echo   ALL 5 SERVICES LAUNCHED SUCCESSFULLY!
echo =================================================================
echo.
echo   * Frontend Portal:  http://localhost:5173
echo   * Backend API:      http://localhost:5000/api/v1/health
echo   * AI/ML Service:    http://localhost:8000/health
echo   * Hardhat Node:     http://127.0.0.1:8545
echo   * PostgreSQL DB:    127.0.0.1:5432 (medrynx_db)
echo.
echo Keep all terminal windows open while testing.
echo Press any key to exit this launcher window.
pause >nul

