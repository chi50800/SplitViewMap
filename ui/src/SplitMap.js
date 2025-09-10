import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, ImageOverlay, useMap, FeatureGroup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import loadTiff from "./loadTiff";
import "leaflet.sync";
import L from "leaflet";
import { EditControl } from "react-leaflet-draw";
import { createJob, getLatestJobDetail } from "./JobService";

function FitBounds({ bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) map.fitBounds(bounds);
    }, [bounds, map]);
    return null;
}

function RasterViewer({ file, overlayData, onMapReady, setAoi, drawEnabled, onDrawComplete }) {
    const [overlay, setOverlay] = useState(null);

    useEffect(() => {
        if (overlayData) {
            // 🔹 use processed overlay
            setOverlay(overlayData);
        } else if (file) {
            // 🔹 load from local file
            loadTiff(file).then(setOverlay);
        } else {
            setOverlay(null);
        }
    }, [file, overlayData]);

    return (
        <MapContainer whenCreated={onMapReady} style={{ height: "400px", width: "100%" }}>
            {overlay && (
                <>
                    <ImageOverlay url={overlay.url} bounds={overlay.bounds} />
                    <FitBounds bounds={overlay.bounds} />
                </>
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
                            const layer = e.layer;
                            if (layer instanceof L.Rectangle) {
                                const aoiType = "rectangle";
                                const bounds = layer.getBounds();
                                setAoi({ type: aoiType, bounds });
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

    const [status, setStatus] = useState("");
    const [processed, setProcessed] = useState(null);
    const [processedOverlay, setProcessedOverlay] = useState(null); // 🔹 overlay data after "Show Processed"

    const leftMap = useRef(null);
    const rightMap = useRef(null);

    const handleProcess = useCallback(async () => {
        if (!fileA || !fileB || !aoi) {
            alert("Please select both images and draw AOI before processing.");
            return;
        }

        try {
            setStatus("Creating job…");
            const job = await createJob(fileA, fileB, aoi);
            console.log("Job created:", job);

            const pollInterval = 3000;
            const maxAttempts = 20;
            let attempts = 0;

            if (job?.job_id) {
                const intervalId = setInterval(async () => {
                    attempts++;
                    const latest = await getLatestJobDetail(job.job_id);
                    console.log("Polled job:", latest);
                    setStatus(latest.status);

                    if (latest.status === "done") {
                        setProcessed(latest.outputs);
                        clearInterval(intervalId);
                        setStatus("✅ Done");
                    } else if (latest.status === "error") {
                        setStatus("❌ Error: " + (latest.error || ""));
                        clearInterval(intervalId);
                    } else if (attempts >= maxAttempts) {
                        setStatus("⏳ Timed out");
                        clearInterval(intervalId);
                    }
                }, pollInterval);
            }
        } catch (error) {
            console.error("Error processing job:", error);
            setStatus("❌ Failed to process job");
        }
    }, [fileA, fileB, aoi]);

    const toggleSelectAoi = () => {
        setSelectingAoi(true);
    };

    // 🔹 Show processed images in split view
    const handleShowProcessed = async () => {
        if (!processed) {
            alert("No processed output yet.");
            return;
        }
        console.log(processed);
        try {
            const imageAResp = await fetch(processed.imageA);
            const imageBResp = await fetch(processed.imageB);

            const imageABlob = await imageAResp.blob();
            const imageBBlob = await imageBResp.blob();

            setFileA(new File([imageABlob], "A_processed.tif"));
            setFileB(new File([imageBBlob], "B_processed.tif"));
        } catch (err) {
            console.error("Error loading processed images:", err);
        }
    };

    return (
        <div>
            <button onClick={toggleSelectAoi}>Select AOI</button>
            <button onClick={handleProcess} style={{ marginLeft: "10px" }}>
                Save AOI
            </button>

            {/* 🔹 Only show button after job done */}
            {processed && (
                <button onClick={handleShowProcessed} style={{ marginLeft: "10px" }}>
                    Show Processed
                </button>
            )}

            {status && (
                <div style={{ marginTop: "10px" }}>
                    <b>Status:</b> {status}
                </div>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    marginTop: "10px",
                }}
            >
                <div>
                    <h3>Left (Image A)</h3>
                    <input type="file" onChange={(e) => setFileA(e.target.files[0])} />
                    <RasterViewer
                        file={fileA}
                        overlayData={processedOverlay?.left}
                        onMapReady={(map) => (leftMap.current = map)}
                        setAoi={selectingAoi ? setAoi : () => {}}
                        drawEnabled={selectingAoi}
                        onDrawComplete={() => setSelectingAoi(false)}
                    />
                </div>
                <div>
                    <h3>Right (Image B)</h3>
                    <input type="file" onChange={(e) => setFileB(e.target.files[0])} />
                    <RasterViewer
                        file={fileB}
                        overlayData={processedOverlay?.right}
                        onMapReady={(map) => (rightMap.current = map)}
                        setAoi={selectingAoi ? setAoi : () => {}}
                        drawEnabled={selectingAoi}
                        onDrawComplete={() => setSelectingAoi(false)}
                    />
                </div>
            </div>
        </div>
    );
}
