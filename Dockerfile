FROM node:20-slim AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

# Install dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/app ./app
COPY resources.yaml ./resources.yaml

# Copy static frontend assets from stage 1
COPY --from=frontend-builder /build/backend/static ./static

ENV LOCALSTACK_URL="http://localstack:4566"
ENV CONFIG_PATH="resources.yaml"
ENV HOST="0.0.0.0"
ENV PORT="4566"

EXPOSE 4566

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4566"]
