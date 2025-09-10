import os
import json
import uuid
import uvicorn
import threading
import traceback
import time
from pathlib import Path

import rasterio
from rasterio.mask import mask
from rasterio.warp import calculate_default_transform, reproject, Resampling
from shapely.geometry import box, mapping
from skimage.registration import phase_cross_correlation
from rasterio.transform import Affine

from fastapi import FastAPI, HTTPException, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Dict
import json

# ----------------- CONFIG -----------------
JOBS_FILE = Path("resource/jobs.json")
OUT_FILE = Path("output")
os.makedirs(JOBS_FILE.parent, exist_ok=True)
os.makedirs(OUT_FILE, exist_ok=True)

# ----------------- JOB MANAGEMENT -----------------
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

def convert_aoi_to_geom(aoi):
    if aoi["type"].lower() == "rectangle":
        sw = aoi["bounds"]["_southWest"]
        ne = aoi["bounds"]["_northEast"]
        aoi_geom = box(sw["lng"], sw["lat"], ne["lng"], ne["lat"])
        return [mapping(aoi_geom)]
    else:
        raise NotImplementedError("Only rectangle AOI is supported currently")

# ----------------- IMAGE PROCESSING -----------------
def reproject_to_epsg4326(src_path, dst_path):
    with rasterio.open(src_path) as src:
        transform, width, height = calculate_default_transform(
            src.crs, "EPSG:4326", src.width, src.height, *src.bounds
        )
        kwargs = src.meta.copy()
        kwargs.update({'crs': "EPSG:4326", 'transform': transform, 'width': width, 'height': height})
        with rasterio.open(dst_path, 'w', **kwargs) as dst:
            for i in range(1, src.count + 1):
                reproject(
                    rasterio.band(src, i),
                    rasterio.band(dst, i),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs="EPSG:4326",
                    resampling=Resampling.nearest
                )
    return dst_path

def clip_image(image_path, aoi, out_path):
    with rasterio.open(image_path) as src:
        geom = convert_aoi_to_geom(aoi)
        out_image, out_transform = mask(src, geom, crop=True)
        out_meta = src.meta.copy()
        out_meta.update({
            "driver": "GTiff",
            "height": out_image.shape[1],
            "width": out_image.shape[2],
            "transform": out_transform,
            "crs": "EPSG:4326"
        })
        with rasterio.open(out_path, "w", **out_meta) as dest:
            dest.write(out_image)
    return out_path

def align_images(image_a_path, image_b_path, out_path):
    with rasterio.open(image_a_path) as src_a, rasterio.open(image_b_path) as src_b:
        img_a = src_a.read(1)
        img_b = src_b.read(1)
        shift_est, _, _ = phase_cross_correlation(img_a, img_b, upsample_factor=10)
        row_shift, col_shift = shift_est
        transform = src_b.transform * Affine.translation(-col_shift, -row_shift)
        kwargs = src_b.meta.copy()
        kwargs.update({"transform": transform, "width": src_b.width, "height": src_b.height})
        with rasterio.open(out_path, "w", **kwargs) as dst:
            for i in range(1, src_b.count + 1):
                reproject(
                    rasterio.band(src_b, i),
                    rasterio.band(dst, i),
                    src_transform=src_b.transform,
                    src_crs=src_b.crs,
                    dst_transform=transform,
                    dst_crs=src_b.crs,
                    resampling=Resampling.nearest
                )
    return out_path

# ----------------- JOB PROCESSING -----------------
def process_job(job_id, job):
    try:
        print(f"[{job_id}] 🚀 Starting job")
        jobs = load_jobs()
        jobs[job_id]["status"] = "running"
        save_jobs(jobs)

        image_a = job["image_a"]
        image_b = job["image_b"]
        aoi = job["aoi"]
        out_dir = OUT_FILE / job_id
        out_dir.mkdir(parents=True, exist_ok=True)

        reprojected_a = out_dir / "A_reprojected.tif"
        reprojected_b = out_dir / "B_reprojected.tif"
        reproject_to_epsg4326(image_a, reprojected_a)
        reproject_to_epsg4326(image_b, reprojected_b)

        clipped_a = out_dir / "A_clipped.tif"
        clipped_b = out_dir / "B_clipped.tif"
        clip_image(reprojected_a, aoi, clipped_a)
        clip_image(reprojected_b, aoi, clipped_b)

        aligned_b = out_dir / "B_clipped_aligned.tif"
        align_images(clipped_a, clipped_b, aligned_b)

        jobs = load_jobs()
        jobs[job_id]["status"] = "done"
        jobs[job_id]["outputs"] = {
            "imageA": f"http://127.0.0.1:8000/output/{job_id}/A_clipped.tif",
            "imageB": f"http://127.0.0.1:8000/output/{job_id}/B_clipped_aligned.tif"
        }
        save_jobs(jobs)
        print(f"[{job_id}] ✅ Completed successfully")
    except Exception as e:
        jobs = load_jobs()
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e) + "\n" + traceback.format_exc()
        save_jobs(jobs)
        print(f"[{job_id}] ❌ Failed: {e}")

def worker_loop(poll_interval=2):
    print("👷 Worker service started, polling for jobs...")
    while True:
        jobs = load_jobs()
        for job_id, job in jobs.items():
            if job["status"] == "pending":
                process_job(job_id, job)
        time.sleep(poll_interval)

# ----------------- FASTAPI SERVER -----------------
app = FastAPI(title="Raster Job Service")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the output folder so React can fetch processed images
app.mount("/output", StaticFiles(directory="output"), name="output")

@app.post("/create-clip")
def api_create_job(
        image_a: UploadFile = File(...),
        image_b: UploadFile = File(...),
        aoi: str = Form(...)
):
    try:
        aoi_dict = json.loads(aoi)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid AOI JSON")

    job_id = create_job(image_a, image_b, aoi_dict)
    return {"job_id": job_id, "status": "pending"}

@app.get("/jobs/{job_id}")
def api_get_job(job_id: str):
    jobs = load_jobs()
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

# ----------------- START WORKER THREAD -----------------
def start_worker():
    thread = threading.Thread(target=worker_loop, daemon=True)
    thread.start()

@app.on_event("startup")
def on_startup():
    start_worker()

# ----------------- RUN APP -----------------
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
