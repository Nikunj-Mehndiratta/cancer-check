"""
Local server: serves the web pages and the X-ray analysis API.

    python server/app.py            (from the cancer-check folder)

Uploaded images are processed in memory and never written to disk.
Binds to 127.0.0.1 only, so nothing is reachable from other machines.
"""
from __future__ import annotations

import asyncio
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
sys.path.insert(0, str(Path(__file__).parent))

import uvicorn  # noqa: E402
from fastapi import FastAPI, File, HTTPException, UploadFile  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

import xray  # noqa: E402

WEB_DIR = Path(__file__).resolve().parent.parent / "web"
MAX_BYTES = 40 * 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(xray.load_model)
    yield


app = FastAPI(title="Cancer Check (local)", lifespan=lifespan, docs_url=None, redoc_url=None)


@app.post("/api/xray")
async def analyse_xray(file: UploadFile = File(...)):
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File is larger than 40 MB.")
    if not data:
        raise HTTPException(400, "The file is empty.")
    try:
        return await asyncio.to_thread(xray.analyse, data, file.filename or "")
    except xray.NotAnXray as e:
        raise HTTPException(422, str(e))


@app.get("/api/health")
def health():
    return {"ok": True, "model": xray.MODEL_WEIGHTS}


app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
