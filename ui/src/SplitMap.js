import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, ImageOverlay, useMap, FeatureGroup, Rectangle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import loadTiff from "./loadTiff";
import "leaflet.sync";
import L from "leaflet";
import { EditControl } from "react-leaflet-draw";
import { createJob, getLatestJobDetail } from "./JobService";
import "./SplitMap.css";

// Simple toast component
function Toast({ message, onClose }) {
    if (!message) return null;
    return (
        <div className="toast">
            {message}
            <button onClick={onClose}>&times;</button>
        </div>
    );
}

function FitBounds({ bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) map.fitBounds(bounds);
    }, [bounds, map]);
    return null;
}

function RasterViewer({ file, onMapReady, setAoi, drawEnabled, onDrawComplete, aoi }) {
    const [overlay, setOverlay] = useState(null);

    useEffect(() => {
        if (file) {
            loadTiff(file).then(setOverlay).catch(() => setOverlay(null));
        } else {
            setOverlay(null);
        }
    }, [file]);

    return (
        <MapContainer whenCreated={onMapReady} style={{ height: "400px", width: "100%" }}>
            {overlay && (
                <>
                    <ImageOverlay url={overlay.url} bounds={overlay.bounds} />
                    <FitBounds bounds={overlay.bounds} />
                </>
            )}

            {/* Render AOI rectangle */}
            {aoi && aoi.type === "rectangle" && (
                <Rectangle bounds={aoi.bounds} pathOptions={{ color: "red" }} />
            )}

            <FeatureGroup>
                {drawEnabled && (
                    <EditControl
                        position="topright"
                        draw={{
                            rectangle: true,
                            polygon: false,
                            circle: false,
                            marker: false,
                            polyline: false,
                            circlemarker: false,
                        }}
                        edit={{ edit: false, remove: true }}
                        onCreated={(e) => {
                            if (e.layer instanceof L.Rectangle) {
                                setAoi({ type: "rectangle", bounds: e.layer.getBounds() });
                            }
                            onDrawComplete && onDrawComplete();
                        }}
                    />
                )}
            </FeatureGroup>
        </MapContainer>
    );
}

export default function SplitMap() {
    const [fileA, setFileA] = useState(null);
    const [fileB, setFileB] = useState(null);
    const [aoi, setAoi] = useState(null);
    const [selectingAoi, setSelectingAoi] = useState(false);

    const [processed, setProcessed] = useState(null);
    const [loading, setLoading] = useState(false);

    const [toast, setToast] = useState("");

    const leftMap = useRef(null);
    const rightMap = useRef(null);

    const handleProcess = useCallback(async () => {
        if (!fileA || !fileB) {
            setToast("Please upload both images.");
            return;
        }
        if (!aoi) {
            setToast("Please select an AOI before processing.");
            return;
        }

        try {
            setLoading(true);
            setToast("Creating job…");

            const job = await createJob(fileA, fileB, aoi);

            const pollInterval = 3000;
            const maxAttempts = 20;
            let attempts = 0;

            if (job?.job_id) {
                const intervalId = setInterval(async () => {
                    attempts++;
                    const latest = await getLatestJobDetail(job.job_id);

                    if (latest.status === "done") {
                        setProcessed(latest.outputs);
                        clearInterval(intervalId);
                        setToast("Job completed successfully");
                        setLoading(false);
                    } else if (latest.status === "error") {
                        setToast("Job failed: " + (latest.error || "Unknown error"));
                        clearInterval(intervalId);
                        setLoading(false);
                    } else if (attempts >= maxAttempts) {
                        setToast("Job timed out");
                        clearInterval(intervalId);
                        setLoading(false);
                    } else {
                        setToast("Job status: " + latest.status);
                    }
                }, pollInterval);
            }
        } catch (error) {
            console.error("Error processing job:", error);
            setToast("Failed to process job");
            setLoading(false);
        }
    }, [fileA, fileB, aoi]);

    const toggleSelectAoi = () => {
        if (aoi) {
            // Reset AOI
            setAoi(null);
            setToast("AOI has been reset");
        } else {
            // Enable AOI selection
            setSelectingAoi(true);
            setToast("Draw a rectangle to select AOI");
        }
    };

    const handleShowProcessed = async () => {
        if (!processed) {
            setToast("No processed output yet.");
            return;
        }
        try {
            const imageAResp = await fetch(processed.imageA);
            const imageBResp = await fetch(processed.imageB);

            const imageABlob = await imageAResp.blob();
            const imageBBlob = await imageBResp.blob();

            setFileA(new File([imageABlob], "A_processed.tif"));
            setFileB(new File([imageBBlob], "B_processed.tif"));
            setToast("Processed images loaded");
        } catch (err) {
            console.error("Error loading processed images:", err);
            setToast("Could not load processed images.");
        }
    };

    return (
        <div className="splitmap-container">
            <Toast message={toast} onClose={() => setToast("")} />

            <div className="splitmap-actions">
                <button onClick={toggleSelectAoi} disabled={!fileA || !fileB || loading}>
                    {aoi ? "Reset AOI" : "Select AOI"}
                </button>
                <button onClick={handleProcess} disabled={!fileA || !fileB || loading}>
                    Save AOI
                </button>
                {processed && (
                    <button
                        onClick={handleShowProcessed}
                        className="processed"
                        disabled={loading}
                    >
                        Show Processed
                    </button>
                )}
            </div>

            <div className="splitmap-panels">
                <div className="splitmap-panel">
                    <h3>Left (Image A)</h3>
                    <input type="file" onChange={(e) => setFileA(e.target.files[0])} />
                    <RasterViewer
                        file={fileA}
                        onMapReady={(map) => (leftMap.current = map)}
                        setAoi={selectingAoi ? setAoi : () => {}}
                        drawEnabled={selectingAoi}
                        onDrawComplete={() => setSelectingAoi(false)}
                        aoi={aoi}
                    />
                </div>

                <div className="splitmap-panel">
                    <h3>Right (Image B)</h3>
                    <input type="file" onChange={(e) => setFileB(e.target.files[0])} />
                    <RasterViewer
                        file={fileB}
                        onMapReady={(map) => (rightMap.current = map)}
                        setAoi={selectingAoi ? setAoi : () => {}}
                        drawEnabled={selectingAoi}
                        onDrawComplete={() => setSelectingAoi(false)}
                        aoi={aoi}
                    />
                </div>
            </div>
        </div>
    );
}

