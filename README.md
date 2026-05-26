# AI Model Serving Project

> Serve multiple Hugging Face models via FastAPI and interact with them through a premium React (Vite) frontend.

## Architecture

```
React Frontend (Vite + Raw CSS)
        |
        v
FastAPI Backend (Python)
        |
        v
Hugging Face Transformers
  ├── Sentiment Analysis   (distilbert)
  ├── Text Summarization   (distilbart-cnn)
  └── Text Generation      (gpt2)
```

## Folder Structure

```
ai-model-serving-project/
├── backend/
│   ├── app.py              # FastAPI application with 3 endpoints
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # All React UI code
│   │   ├── App.css         # Raw CSS (dark premium theme)
│   │   └── main.jsx        # Entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint          | Description                       | Payload                              |
| ------ | ----------------- | --------------------------------- | ------------------------------------ |
| GET    | `/`               | Health check                      | —                                    |
| GET    | `/api/models`     | List served models                | —                                    |
| POST   | `/api/sentiment`  | Sentiment analysis                | `{ "text": "..." }`                  |
| POST   | `/api/summarize`  | Text summarization                | `{ "text": "..." }`                  |
| POST   | `/api/generate`   | Text generation                   | `{ "text": "...", "max_length": N }` |

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

The first request to each endpoint will download the corresponding Hugging Face model (~200 MB – 1.2 GB). Subsequent requests use the cached model.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### 3. Try It Out

1. Select a task tab (Sentiment / Summarization / Generation).
2. Enter text and click the action button.
3. View the AI-generated result.

## Tech Stack

- **Backend** — Python, FastAPI, Uvicorn, Hugging Face Transformers, PyTorch
- **Frontend** — React 19, Vite, Raw CSS
- **Models** — distilbert (sentiment), distilbart-cnn (summarization), GPT-2 (generation)

## Deployment

| Component | Recommended Platforms              |
| --------- | ---------------------------------- |
| Backend   | Render, Railway, AWS EC2, Fly.io   |
| Frontend  | Vercel, Netlify, GitHub Pages      |

For production, build the frontend with `npm run build` and serve the `dist/` folder as static files.

## License

MIT
