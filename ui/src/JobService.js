// JobService.js
// Functions to interact with backend job APIs

const API_BASE = process.env.REACT_APP_API_URL || "http://0.0.0.0:8000"; // change to your Python server address

/**
 * Create a new processing job
 * @param {File} fileA - GeoTIFF A
 * @param {File} fileB - GeoTIFF B
 * @param {Object} aoi - Leaflet bounds object
 * @returns {Promise<Object>} - Response from backend
 */
export async function createJob(fileA, fileB, aoi) {
    const formData = new FormData();
    formData.append("image_a", fileA);
    formData.append("image_b", fileB);
    formData.append("aoi", JSON.stringify(aoi));

    const response = await fetch(`${API_BASE}/create-clip`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Failed to create job: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Fetch the latest job result
 * @returns {Promise<Object>} - Latest job details (e.g., processed image URLs, status)
 */
export async function getLatestJobDetail(job_id) {
    const response = await fetch(`${API_BASE}/jobs/${job_id}`, {
        method: "GET",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch latest job: ${response.statusText}`);
    }

    return await response.json();
}
