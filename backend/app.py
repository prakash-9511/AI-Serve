"""
AI Model Serving Backend — FastAPI + Hugging Face Transformers
Serves 3 AI models: Sentiment Analysis, Text Summarization, Text Generation
"""

import os

# Fix: Disable HF Hub telemetry to prevent httpx client-closed errors
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["DO_NOT_TRACK"] = "1"

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification, AutoModelForSeq2SeqLM, AutoModelForCausalLM
import logging

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model definitions
# ---------------------------------------------------------------------------
MODEL_CONFIGS = {
    "sentiment": {
        "task": "sentiment-analysis",
        "model_name": "distilbert-base-uncased-finetuned-sst-2-english",
        "auto_model_class": AutoModelForSequenceClassification,
    },
    "generate": {
        "task": "text-generation",
        "model_name": "gpt2",
        "auto_model_class": AutoModelForCausalLM,
    },
}

# Summarization model (handled separately — no pipeline alias in transformers 5.x)
SUMMARIZE_MODEL_NAME = "sshleifer/distilbart-cnn-12-6"
_summarize_model = None
_summarize_tokenizer = None

# ---------------------------------------------------------------------------
# Pipeline store
# ---------------------------------------------------------------------------
_pipelines: dict = {}


def load_pipeline(key: str):
    """Load a pipeline by explicitly instantiating the tokenizer and model
    first, which avoids the httpx 'client has been closed' bug in
    transformers >= 5.x."""
    if key in _pipelines:
        return _pipelines[key]

    cfg = MODEL_CONFIGS[key]
    model_name = cfg["model_name"]
    task = cfg["task"]
    auto_cls = cfg["auto_model_class"]

    logger.info(f"⏳  Loading tokenizer for {model_name} …")
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    logger.info(f"⏳  Loading model for {model_name} …")
    model = auto_cls.from_pretrained(model_name)

    logger.info(f"⏳  Creating pipeline  task={task} …")
    pipe = pipeline(task, model=model, tokenizer=tokenizer)

    _pipelines[key] = pipe
    logger.info(f"✅  Pipeline ready  task={task}")
    return pipe


def load_summarizer():
    """Load the summarization model & tokenizer directly (no pipeline)."""
    global _summarize_model, _summarize_tokenizer
    if _summarize_model is not None:
        return _summarize_tokenizer, _summarize_model

    logger.info(f"⏳  Loading tokenizer for {SUMMARIZE_MODEL_NAME} …")
    _summarize_tokenizer = AutoTokenizer.from_pretrained(SUMMARIZE_MODEL_NAME)

    logger.info(f"⏳  Loading model for {SUMMARIZE_MODEL_NAME} …")
    _summarize_model = AutoModelForSeq2SeqLM.from_pretrained(SUMMARIZE_MODEL_NAME)

    logger.info("✅  Summarization model ready")
    return _summarize_tokenizer, _summarize_model


# ---------------------------------------------------------------------------
# Lifespan — preload all models at startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app):
    logger.info("🚀  Preloading all models …")
    for key in MODEL_CONFIGS:
        try:
            load_pipeline(key)
        except Exception as e:
            logger.warning(f"⚠️  Could not preload '{key}': {e}  (will retry on first request)")
    try:
        load_summarizer()
    except Exception as e:
        logger.warning(f"⚠️  Could not preload summarizer: {e}  (will retry on first request)")
    logger.info("🟢  All models loaded — server ready")
    yield


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AI Model Serving API",
    description="Serve Hugging Face models for Sentiment Analysis, Summarization & Text Generation",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server and common origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------
class TextRequest(BaseModel):
    text: str


class GenerateRequest(BaseModel):
    text: str
    max_length: int = 100


class SentimentResponse(BaseModel):
    label: str
    score: float


class SummaryResponse(BaseModel):
    summary: str


class GenerateResponse(BaseModel):
    generated_text: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {
        "message": "AI Model Serving API is running",
        "endpoints": ["/api/sentiment", "/api/summarize", "/api/generate"],
    }


@app.get("/api/models")
def list_models():
    """Return metadata about the three served models."""
    return [
        {
            "task": "Sentiment Analysis",
            "model": "distilbert-base-uncased-finetuned-sst-2-english",
            "endpoint": "/api/sentiment",
        },
        {
            "task": "Text Summarization",
            "model": "sshleifer/distilbart-cnn-12-6",
            "endpoint": "/api/summarize",
        },
        {
            "task": "Text Generation",
            "model": "gpt2",
            "endpoint": "/api/generate",
        },
    ]


@app.post("/api/sentiment", response_model=SentimentResponse)
def sentiment_analysis(req: TextRequest):
    """Analyse the sentiment of the supplied text."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty.")
    try:
        pipe = load_pipeline("sentiment")
        result = pipe(req.text[:512])[0]
        return SentimentResponse(label=result["label"], score=round(result["score"], 4))
    except Exception as e:
        logger.error(f"Sentiment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/summarize", response_model=SummaryResponse)
def summarize_text(req: TextRequest):
    """Summarise a long piece of text."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty.")
    try:
        tokenizer, model = load_summarizer()
        inputs = tokenizer(req.text[:1024], return_tensors="pt", max_length=1024, truncation=True)
        summary_ids = model.generate(
            inputs["input_ids"],
            max_length=130,
            min_length=30,
            do_sample=False,
            num_beams=4,
        )
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return SummaryResponse(summary=summary)
    except Exception as e:
        logger.error(f"Summarization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate", response_model=GenerateResponse)
def generate_text(req: GenerateRequest):
    """Generate text continuing from the given prompt."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Prompt must not be empty.")
    try:
        pipe = load_pipeline("generate")
        result = pipe(
            req.text,
            max_new_tokens=min(req.max_length, 200),
            num_return_sequences=1,
            do_sample=True,
            temperature=0.8,
        )
        return GenerateResponse(generated_text=result[0]["generated_text"])
    except Exception as e:
        logger.error(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
