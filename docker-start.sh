#!/bin/bash
echo "============================================================"
echo "SCHEDULE CONTROL & PROJECT GOVERNANCE — DOCKER LAUNCHER"
echo "============================================================"

if ! docker info > /dev/null 2>&1; then
    echo "[ERROR] Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "Building and launching container..."
docker compose up --build -d

echo ""
echo "============================================================"
echo "Application is running!"
echo "Access the dashboard in your browser at:"
echo "  http://localhost:3001"
echo "============================================================"
