from shapely.geometry import box, mapping
import rasterio
from rasterio.mask import mask
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.transform import Affine
from skimage.registration import phase_cross_correlation

def convert_aoi_to_geom(aoi):
    if aoi["type"].lower() == "rectangle":
        sw = aoi["bounds"]["_southWest"]
        ne = aoi["bounds"]["_northEast"]
        aoi_geom = box(sw["lng"], sw["lat"], ne["lng"], ne["lat"])
        return [mapping(aoi_geom)]
    # Similarly can be implemented for polygon, circle etc.
    else:
        raise NotImplementedError("Only rectangle AOI is supported currently")

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
