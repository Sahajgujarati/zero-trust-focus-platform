# Zero-Trust Focus Platform

A real-time productivity monitoring ecosystem utilizing a microservices pipeline to classify active tab browsing behavior against dynamic focus categorizations.

## Demo

https://github.com/user-attachments/assets/a6da98ae-c3d2-4499-9273-bd120c0d44ff

## Architecture

This project has been designed with simplicity in mind so that you can run it immediately without complex environment setups (like Postgres or Redis). 

1. **`frontend/`**: React 18 + Vite + Tailwind CSS Dashboard. Connects via Socket.io to view live focus scores.
2. **`backend/`**: Node.js + Express + Socket.io Server + Prisma ORM (SQLite). Handles user scores and real-time alerts.
3. **`extension/`**: Chrome MV3 Extension. Monitors active tabs and sends REST API updates to the backend for scoring.
4. **`ai-service/`**: Optional Python FastAPI service with basic AI heuristics.

## Quick Start

### 1. Backend Server
```bash
cd backend
npm install
npx prisma db push
node server.js
```
*Runs on port 4000.*

### 2. Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
*Runs on port 5173.*

### 3. Load the Chrome Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select the `extension/` folder from this directory.
4. Click on the extension icon in Chrome, enter a Username and Room ID (create one in the dashboard), and hit Connect.

## Usage
1. Open the React Dashboard, click **New** to create a Room, and join it.
2. The Chrome extension will automatically monitor your active tab.
3. If you open a distracting site (like youtube.com), your focus score will drop, and everyone in the room will see a red flashing alert.
4. If you stay on productive sites (like github.com or leetcode.com), your score increases.
