import json
import uuid
from fastapi import UploadFile
from typing import Dict
from pathlib import Path
from config import JOBS_FILE, OUT_FILE

def load_jobs() -> Dict:
    if JOBS_FILE.exists():
        try:
            with open(JOBS_FILE, "r") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}

def save_jobs(jobs: Dict):
    with open(JOBS_FILE, "w") as f:
        json.dump(jobs, f, indent=2)

def create_job(image_a: UploadFile, image_b: UploadFile, aoi: dict) -> str:
    jobs = load_jobs()
    job_id = str(uuid.uuid4())

    out_dir = OUT_FILE / job_id
    out_dir.mkdir(parents=True, exist_ok=True)

    image_a_path = out_dir / f"A_{image_a.filename}"
    image_b_path = out_dir / f"B_{image_b.filename}"

    with open(image_a_path, "wb") as f:
        f.write(image_a.file.read())
    with open(image_b_path, "wb") as f:
        f.write(image_b.file.read())

    jobs[job_id] = {
        "status": "pending",
        "image_a": str(image_a_path),
        "image_b": str(image_b_path),
        "aoi": aoi,
        "outputs": {},
        "error": ""
    }
    save_jobs(jobs)
    return job_id
