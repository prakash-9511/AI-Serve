import { useState } from "react";
import "./App.css";

/* ──────────────────────────────────────────────
   API helper
   ────────────────────────────────────────────── */
const API = "http://localhost:8000";

async function callApi(endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Server error");
  }
  return res.json();
}

/* ──────────────────────────────────────────────
   Tab metadata
   ────────────────────────────────────────────── */
const TABS = [
  {
    id: "sentiment",
    label: "Sentiment Analysis",
    icon: "😊",
    model: "distilbert-base-uncased-finetuned-sst-2-english",
    desc: "Detect whether text carries a positive or negative sentiment.",
  },
  {
    id: "summarize",
    label: "Text Summarization",
    icon: "📝",
    model: "sshleifer/distilbart-cnn-12-6",
    desc: "Condense a long passage into a concise summary.",
  },
  {
    id: "generate",
    label: "Text Generation",
    icon: "✨",
    model: "gpt2",
    desc: "Continue writing from a prompt using GPT-2.",
  },
];

/* ──────────────────────────────────────────────
   Main App
   ────────────────────────────────────────────── */
export default function App() {
  const [activeTab, setActiveTab] = useState("sentiment");
  const [loading, setLoading] = useState(false);

  /* ---- Sentiment state ---- */
  const [sentimentText, setSentimentText] = useState("");
  const [sentimentResult, setSentimentResult] = useState(null);

  /* ---- Summarization state ---- */
  const [summarizeText, setSummarizeText] = useState("");
  const [summarizeResult, setSummarizeResult] = useState(null);

  /* ---- Generation state ---- */
  const [generateText, setGenerateText] = useState("");
  const [generateMax, setGenerateMax] = useState(100);
  const [generateResult, setGenerateResult] = useState(null);

  const [error, setError] = useState("");

  /* ── handlers ─────────────────────────────── */
  async function handleSentiment(e) {
    e.preventDefault();
    setError("");
    setSentimentResult(null);
    setLoading(true);
    try {
      const data = await callApi("/api/sentiment", { text: sentimentText });
      setSentimentResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSummarize(e) {
    e.preventDefault();
    setError("");
    setSummarizeResult(null);
    setLoading(true);
    try {
      const data = await callApi("/api/summarize", { text: summarizeText });
      setSummarizeResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setError("");
    setGenerateResult(null);
    setLoading(true);
    try {
      const data = await callApi("/api/generate", {
        text: generateText,
        max_length: Number(generateMax),
      });
      setGenerateResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* ── render helpers ───────────────────────── */
  function renderSentiment() {
    return (
      <form className="task-form" onSubmit={handleSentiment}>
        <label htmlFor="sentiment-input">Enter text to analyse</label>
        <textarea
          id="sentiment-input"
          rows={4}
          placeholder="e.g. I absolutely love this new feature!"
          value={sentimentText}
          onChange={(e) => setSentimentText(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <span className="spinner" /> : "Analyse Sentiment"}
        </button>

        {sentimentResult && (
          <div className="result-card fade-in">
            <div className="result-header">Result</div>
            <div className="sentiment-badge-row">
              <span
                className={`sentiment-badge ${
                  sentimentResult.label === "POSITIVE" ? "positive" : "negative"
                }`}
              >
                {sentimentResult.label === "POSITIVE" ? "👍" : "👎"}{" "}
                {sentimentResult.label}
              </span>
              <span className="score-pill">
                Confidence: {(sentimentResult.score * 100).toFixed(2)}%
              </span>
            </div>
            <div className="confidence-bar-track">
              <div
                className="confidence-bar-fill"
                style={{ width: `${sentimentResult.score * 100}%` }}
              />
            </div>
          </div>
        )}
      </form>
    );
  }

  function renderSummarize() {
    return (
      <form className="task-form" onSubmit={handleSummarize}>
        <label htmlFor="summarize-input">
          Paste a long paragraph to summarise
        </label>
        <textarea
          id="summarize-input"
          rows={6}
          placeholder="Paste an article or long text here…"
          value={summarizeText}
          onChange={(e) => setSummarizeText(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <span className="spinner" /> : "Summarise Text"}
        </button>

        {summarizeResult && (
          <div className="result-card fade-in">
            <div className="result-header">Summary</div>
            <p className="result-text">{summarizeResult.summary}</p>
          </div>
        )}
      </form>
    );
  }

  function renderGenerate() {
    return (
      <form className="task-form" onSubmit={handleGenerate}>
        <label htmlFor="generate-input">Enter a prompt</label>
        <textarea
          id="generate-input"
          rows={3}
          placeholder="e.g. Once upon a time in a futuristic city…"
          value={generateText}
          onChange={(e) => setGenerateText(e.target.value)}
          required
        />

        <div className="slider-group">
          <label htmlFor="max-length-slider">
            Max length: <strong>{generateMax}</strong>
          </label>
          <input
            id="max-length-slider"
            type="range"
            min={30}
            max={200}
            value={generateMax}
            onChange={(e) => setGenerateMax(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <span className="spinner" /> : "Generate Text"}
        </button>

        {generateResult && (
          <div className="result-card fade-in">
            <div className="result-header">Generated Text</div>
            <p className="result-text">{generateResult.generated_text}</p>
          </div>
        )}
      </form>
    );
  }

  const currentTab = TABS.find((t) => t.id === activeTab);

  return (
    <div className="app">
      {/* ── Hero ─────────────────────────────── */}
      <header className="hero">
        <div className="hero-glow" />
        <h1 className="hero-title">
          <span className="gradient-text">AI Model Serving</span> Project
        </h1>
        <p className="hero-sub">
          Powered by <strong>FastAPI</strong> &amp;{" "}
          <strong>Hugging Face Transformers</strong>
        </p>
      </header>

      {/* ── Tab bar ──────────────────────────── */}
      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab.id);
              setError("");
            }}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Task panel ───────────────────────── */}
      <main className="task-panel glass" key={activeTab}>
        <div className="task-meta">
          <span className="task-meta-icon">{currentTab.icon}</span>
          <div>
            <h2 className="task-title">{currentTab.label}</h2>
            <p className="task-desc">{currentTab.desc}</p>
          </div>
        </div>
        <div className="model-chip">
          🤗 <code>{currentTab.model}</code>
        </div>

        {error && (
          <div className="error-banner fade-in">
            <span>⚠️</span> {error}
          </div>
        )}

        {activeTab === "sentiment" && renderSentiment()}
        {activeTab === "summarize" && renderSummarize()}
        {activeTab === "generate" && renderGenerate()}
      </main>

      {/* ── Footer ───────────────────────────── */}
      <footer className="footer">
        <p>
          AI Model Serving Project &middot; FastAPI + Hugging Face + React
          (Vite)
        </p>
      </footer>
    </div>
  );
}
