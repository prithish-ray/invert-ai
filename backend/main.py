import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

load_dotenv()

from database import create_tables
from routes.auth import router as auth_router
from routes.decisions import router as decisions_router
from routes.journal import router as journal_router
from routes.bias import router as bias_router

app = FastAPI(title="Invert API", version="1.0.0")

# Create DB tables on startup
@app.on_event("startup")
def startup():
    create_tables()

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth_router)
app.include_router(decisions_router)
app.include_router(journal_router)
app.include_router(bias_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Serve React build in production ──────────────────────────────────────────
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_react(full_path: str):
        index = os.path.join(FRONTEND_DIST, "index.html")
        return FileResponse(index)
