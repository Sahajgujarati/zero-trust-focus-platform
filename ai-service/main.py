from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import re

app = FastAPI(title="Zero-Trust Focus - AI Classification Service")

class ClassifyRequest(BaseModel):
    url: str
    focus_category: str = "general"

class ClassifyResponse(BaseModel):
    is_productive: bool
    confidence: float
    reason: str

# Simple mock heuristics for demonstration without needing an OpenAI key
PRODUCTIVE_KEYWORDS = ["github", "leetcode", "stackoverflow", "docs", "developer", "localhost"]
DISTRACTING_KEYWORDS = ["youtube", "netflix", "twitter", "instagram", "facebook", "reddit"]

@app.post("/classify", response_model=ClassifyResponse)
async def classify_tab(request: ClassifyRequest):
    url = request.url.lower()
    
    # Check for distracting keywords
    for keyword in DISTRACTING_KEYWORDS:
        if keyword in url:
            return ClassifyResponse(
                is_productive=False,
                confidence=0.9,
                reason=f"Found distracting keyword: {keyword}"
            )
            
    # Check for productive keywords
    for keyword in PRODUCTIVE_KEYWORDS:
        if keyword in url:
            return ClassifyResponse(
                is_productive=True,
                confidence=0.85,
                reason=f"Found productive keyword: {keyword}"
            )
            
    # Default behavior
    return ClassifyResponse(
        is_productive=True,
        confidence=0.5,
        reason="No known distracting patterns detected."
    )

@app.get("/")
def read_root():
    return {"message": "AI Classification Service is running."}

# To run: uvicorn main:app --reload --port 8000
