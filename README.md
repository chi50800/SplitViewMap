
# SplitViewMap

## Getting Started with the Application

This project uses **React** for the front end and **FastAPI** for the back end. It allows you to process, align, and visualize geospatial images. The backend performs operations such as **image reprojection**, **clipping**, and **alignment** based on an **Area of Interest (AOI)** provided by the user.

---

## Prerequisites

Before you begin, make sure you have the following installed:

- Docker
- Docker Compose

If you don't have them, you can install them from the official websites:

- [Docker Installation](https://docs.docker.com/get-docker/)
- [Docker Compose Installation](https://docs.docker.com/compose/install/)

---

## Setup and Run

To set up and run the application, follow these steps:

1. Clone the repository:

    ```bash
    git clone https://github.com/your-repository/SplitViewMap.git
    cd SplitViewMap
    ```

2. Build and start the containers using `docker-compose`:

    ```bash
    docker-compose up --build
    ```

   This command will:
   - Build the Docker images for both the **UI** and **Worker**.
   - Start the **UI** container running a React application on port `3000`.
   - Start the **Worker** container running a FastAPI application on port `8000`.

3. After the containers are up, you can access:
   - **Frontend UI**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:8000](http://localhost:8000)

---

## API Endpoints

### 1. **Create a New Job** (`POST /create-clip`)

This endpoint is used to create a new job for aligning two raster images based on a specified **Area of Interest (AOI)**.

**Request Body**:

- `image_a` and `image_b`: The images to align (should be in `.tif` format).
- `aoi`: A string containing a **JSON object** representing the Area of Interest, which should include bounds in **latitude/longitude** coordinates.

**Example Payload**:

```json
{
  "aoi": "{\"type\": \"rectangle\", \"bounds\": {\"_southWest\": {\"lat\": 10, \"lng\": 20}, \"_northEast\": {\"lat\": 30, \"lng\": 40}}}"
}
````

**Response**:

```json
{
  "job_id": "1234-5678-91011",
  "status": "pending"
}
```

### 2. **Get Job Status** (`GET /jobs/{job_id}`)

This endpoint retrieves the status and results of a previously created job.

**Request URL**: `/jobs/{job_id}`

**Response**:

```json
{
  "status": "done",
  "image_a": "http://127.0.0.1:8000/output/1234-5678-91011/A_clipped.tif",
  "image_b": "http://127.0.0.1:8000/output/1234-5678-91011/B_clipped_aligned.tif"
}
```

### 3. **Download Output Images**

After a job is completed, the resulting aligned images can be accessed by the URLs provided in the `GET /jobs/{job_id}` response.

---

## Explanation of Image Alignment

### **Image Reprojection**:

* **Reprojection** is the process of converting the image from its current coordinate reference system (CRS) into **EPSG:4326** (WGS84), which is commonly used for web mapping applications. This ensures that both images are in the same CRS, which is a requirement for alignment.
* In this project, the images are reprojected using the `rasterio` library. We use the `calculate_default_transform` function to transform the images to the EPSG:4326 CRS.

### **Image Clipping**:

* **Clipping** is the process of cutting the images to a specific **Area of Interest (AOI)**, which is provided by the user in the request. Currently, only rectangular AOIs are supported.
* The `shapely.geometry` library is used to create a bounding box for the specified AOI, and the `rasterio.mask.mask` function is used to clip the images to that bounding box.

### **Image Alignment**:

* **Image Alignment** involves aligning the two images so that they match spatially. This is done using **cross-correlation**, which is a technique to identify the shift between two images.
* We use the `skimage.registration.phase_cross_correlation` function to compute the pixel shift between the images. The shift is then applied to one of the images using **affine transformation**, so that both images are aligned.

---

## Worker Service

The backend worker service polls for jobs (image processing requests) and processes them in the background. Each job involves the following steps:

1. Reproject the images to EPSG:4326.
2. Clip the images to the specified AOI.
3. Align the images based on cross-correlation.
4. Save the output and update the job status.

The worker service runs in a background thread and constantly checks for new jobs. Once a job is completed, the output is made available at the specified URL.

---

## Development Notes

* To run the application in **development mode**, you can use the following commands for the UI and backend separately:

  For UI:

  ```bash
  cd ui
  npm start
  ```

  For backend:

  ```bash
  uvicorn main:app --reload
  ```

* You can also run the backend using `docker-compose` to ensure consistency across environments:

  ```bash
  docker-compose up --build backend
  ```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

