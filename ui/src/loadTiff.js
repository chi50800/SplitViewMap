import * as GeoTIFF from "geotiff";
import proj4 from "proj4";

async function loadTiff(file) {
    if (!file) return null;
    console.log(file);

    const arrayBuffer = await file.arrayBuffer();
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();

    const raster = await image.readRasters();
    const width = image.getWidth();
    const height = image.getHeight();
    const bbox = image.getBoundingBox(); // [west, south, east, north]

    // --- CRS handling ---
    let bounds;
    try {
        const epsgCode = image.geoKeys.ProjectedCSTypeGeoKey; // e.g., 3857
        if (epsgCode === 3857) {
            const [west, south] = proj4("EPSG:3857", "EPSG:4326", [bbox[0], bbox[1]]);
            const [east, north] = proj4("EPSG:3857", "EPSG:4326", [bbox[2], bbox[3]]);
            bounds = [
                [south, west],
                [north, east],
            ];
        } else {
            // assume already EPSG:4326
            bounds = [
                [bbox[1], bbox[0]],
                [bbox[3], bbox[2]],
            ];
        }
    } catch (err) {
        console.warn("CRS detection failed, using raw bbox", err);
        bounds = [
            [bbox[1], bbox[0]],
            [bbox[3], bbox[2]],
        ];
    }

    // --- Render to canvas ---
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);

    if (raster.length >= 3) {
        // RGB image
        const [r, g, b] = raster;
        for (let i = 0; i < width * height; i++) {
            imageData.data[i * 4 + 0] = r[i];
            imageData.data[i * 4 + 1] = g[i];
            imageData.data[i * 4 + 2] = b[i];
            imageData.data[i * 4 + 3] = 255;
        }
    } else {
        // Grayscale image
        const data = raster[0];
        let min = data[0];
        let max = data[0];
        for (let i = 1; i < data.length; i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
        }

        for (let i = 0; i < data.length; i++) {
            const val = Math.floor(((data[i] - min) / (max - min)) * 255);
            imageData.data[i * 4 + 0] = val;
            imageData.data[i * 4 + 1] = val;
            imageData.data[i * 4 + 2] = val;
            imageData.data[i * 4 + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    return {
        url: canvas.toDataURL("image/png"),
        bounds,
    };
}

export default loadTiff;
