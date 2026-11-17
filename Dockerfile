# GudangLingling AI — Dockerfile
# Pengembang: Liana Sry Astuti (NIM: 2422031) - ITEBA
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8085

# Salin seluruh kode proyek
COPY . /app

# Buat folder direktori data & upload
RUN mkdir -p /app/database /app/static/uploads

# Expose port aplikasi
EXPOSE 8085

# Healthcheck otomatis
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8085/api/health')" || exit 1

# Jalankan server
CMD ["python3", "app.py"]
