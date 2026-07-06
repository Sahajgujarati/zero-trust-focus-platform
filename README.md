# 🛡️ Zero-Trust Focus Platform

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
</div>

<br/>

> A full-stack, real-time productivity monitoring ecosystem utilizing a microservices pipeline to classify active tab browsing behavior against dynamic focus categorizations.

### 🚀 Live Project Link
**[View the Deployed Application Here](https://your-deployment-link-here.com)**

---

## ✨ Key Features

* **Real-Time Browser Monitoring:** Features a lightweight **Chrome Extension (Manifest V3)** background service worker that captures live navigation metrics and triggers desktop alerts on session whitelisting infractions.
* **Resilient WebSocket Gateway:** Engineered with **Socket.io** utilizing specialized Engine.io status-guard validation checks, ensuring persistent backend synchronization even during transport drops.
* **High-Performance Data Layer:** Integrates an **Upstash Redis** cache layer for ultra-low latency live data persistence.
* **Synchronized Room Coordination:** Manages score computation rules and active session states across synchronized rooms using a **PostgreSQL** database managed through the **Prisma ORM**.

## 🛠️ System Architecture

1. **Client Layer:** React frontend for the user dashboard and room management, alongside an MV3 Chrome Extension for data telemetry.
2. **WebSocket Gateway:** Node.js/Socket.io server handling bidirectional real-time state synchronization.
3. **Microservices (FastAPI):** Python backend classifying URLs and active tabs against dynamic focus categories.
4. **Caching & DB:** Redis coordinates the fast-moving live room data, while PostgreSQL (via Prisma) handles persistent user accounts, historical scores, and rule configurations.

## 💻 Local Installation & Setup

### Prerequisites
* Node.js v18+
* Python 3.9+
* Upstash Redis Account (or local Redis server)
* PostgreSQL database

### 1. Backend Setup (Node.js & FastAPI)
```bash
# Clone the repository
git clone [https://github.com/Sahajgujarati/zero-trust-focus.git](https://github.com/Sahajgujarati/zero-trust-focus.git)
cd zero-trust-focus

# Set up the Node/Express/Socket environment
cd server
npm install

# Configure environment variables (add DB and Redis URIs)
cp .env.example .env

# Generate Prisma Client & push schema
npx prisma generate
npx prisma db push

# Start the Node server
npm run dev

# (In a new terminal) Set up FastAPI microservice
cd ../api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
