import os
from pathlib import Path

JOBS_FILE = Path("resource/jobs.json")
OUT_FILE = Path("output")
os.makedirs(JOBS_FILE.parent, exist_ok=True)
os.makedirs(OUT_FILE, exist_ok=True)

SERVER_URL = "http://127.0.0.1:8000/output/"
