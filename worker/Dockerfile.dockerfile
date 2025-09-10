FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (if you use rasterio, gdal, etc.)
RUN apt-get update && apt-get install -y \
    gdal-bin libgdal-dev python3-gdal \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

EXPOSE 8000
CMD ["python", "main.py"]
