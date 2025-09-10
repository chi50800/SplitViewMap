import threading
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routes import router
from app.worker import worker_loop

app = FastAPI(title="Raster Job Service")

# CORS
origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static output folder
app.mount("/output", StaticFiles(directory="output"), name="output")

# API routes
app.include_router(router)

# Worker thread
def start_worker():
    thread = threading.Thread(target=worker_loop, daemon=True)
    thread.start()

@app.on_event("startup")
def on_startup():
    start_worker()

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
