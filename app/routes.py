from fastapi import APIRouter, UploadFile, Form, HTTPException
from .jobs import create_job, load_jobs

router = APIRouter()

@router.post("/create-clip")
def api_create_job(
        image_a: UploadFile,
        image_b: UploadFile,
        aoi: str = Form(...)
):
    import json
    try:
        aoi_dict = json.loads(aoi)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid AOI JSON")

    job_id = create_job(image_a, image_b, aoi_dict)
    return {"job_id": job_id, "status": "pending"}

@router.get("/jobs/{job_id}")
def api_get_job(job_id: str):
    jobs = load_jobs()
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]
