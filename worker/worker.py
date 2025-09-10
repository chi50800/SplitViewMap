import time
from jobs import load_jobs, save_jobs
from processor import reproject_to_epsg4326, clip_image, align_images
from pathlib import Path
from config import OUT_FILE, SERVER_URL
import traceback

def process_job(job_id, job):
    try:
        print(f"Starting job with id:[{job_id}]")
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
            "imageA": f"{SERVER_URL}{job_id}/A_clipped.tif",
            "imageB": f"{SERVER_URL}{job_id}/B_clipped_aligned.tif"
        }
        save_jobs(jobs)
        print(f"Job [{job_id}] Completed successfully")
    except Exception as e:
        jobs = load_jobs()
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e) + "\n"
        save_jobs(jobs)
        print(f"Job [{job_id}] Failed: {e}")

def worker_loop(poll_interval=2):
    print("Worker service started, polling for job completion...")
    while True:
        jobs = load_jobs()
        for job_id, job in jobs.items():
            if job["status"] == "pending":
                process_job(job_id, job)
        time.sleep(poll_interval)
