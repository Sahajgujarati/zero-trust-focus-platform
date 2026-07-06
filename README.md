# 🏗️ Autonomous Structural Intelligence

<div align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white" alt="OpenCV" />
  <img src="https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI / Claude" />
</div>

<br/>

> An end-to-end AI pipeline that automates the conversion of 2D architectural floor plans into interactive 3D models, featuring autonomous structural analysis and intelligent material recommendations.

### 🚀 Live Project Link
**[View the Deployed Application Here](https://your-deployment-link-here.com)**

---

## ✨ Key Features

* **Automated 3D Generation:** Converts static 2D architectural blueprints and floor plans into fully interactive 3D models natively in the browser using **Three.js**.
* **Advanced Computer Vision:** Utilizes a custom vision engine powered by **OpenCV**, applying **Hough Line Transform** and **Pytesseract (OCR)** to mathematically extract spatial coordinates, wall boundaries, and room metadata from raw images.
* **Intelligent Structural Analysis:** Integrates **Claude/OpenAI LLMs** via a **FastAPI** backend to autonomously scan the extracted architectural data, identify potential structural flaws, and recommend optimal building materials based on the floor plan's context.

## 🛠️ Architecture & Workflow

1. **Input:** User uploads a raw 2D blueprint image (PNG/JPG).
2. **Processing (CV):** The FastAPI backend triggers OpenCV to process the image, detecting lines, corners, and text (room dimensions/labels).
3. **LLM Analysis:** Extracted metadata is fed into the LLM via prompt engineering to analyze load-bearing estimations, room flow, and material suggestions.
4. **Output (3D):** The structured JSON response is sent to the React frontend, where Three.js dynamically renders the navigable 3D environment.

## 💻 Local Installation & Setup

### Prerequisites
* Python 3.8+
* Node.js v16+
* API Keys for OpenAI or Anthropic (Claude)

### Backend Setup (FastAPI & OpenCV)
```bash
# Clone the repository
git clone [https://github.com/Sahajgujarati/Autonomous-Structural-Intelligence.git](https://github.com/Sahajgujarati/Autonomous-Structural-Intelligence.git)
cd Autonomous-Structural-Intelligence/backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Add your LLM API keys to the .env file

# Run the backend server
uvicorn main:app --reload
