# LocalStack Companion

> **Smart Reverse Proxy, Declarative Provisioner & Real-Time Web UI for [LocalStack](https://localstack.cloud/).**

LocalStack Companion eliminates local cloud development friction for **Spring Boot**, **Quarkus**, and AWS SDK applications. It sits transparently on port `:4566`, detects missing AWS resources at runtime, offers 1-click provisioning, and provides an interactive Web UI to inspect messages, buckets, and databases.

---

## ⚠️ Important Requirement: LocalStack Engine

> **LocalStack Companion requires an active LocalStack instance to connect to.**

Companion does **not** replace LocalStack; it acts as an intelligent companion wrapper and reverse proxy:
* **LocalStack Core** runs the simulated AWS engine (internally on port `:4567` or via Docker network).
* **LocalStack Companion** listens on port `:4566` (the standard AWS endpoint) and `:8080` (Web UI), forwarding traffic, intercepting 404/ResourceNotFound errors, and managing declarative synchronization.

---

## 🚀 Quick Start with Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  # 1. Core LocalStack engine
  localstack:
    image: localstack/localstack:3.4.0
    container_name: localstack_core
    ports:
      - "4567:4566" # Internal LocalStack port
    environment:
      - ACTIVATE_PRO=0
      - DEBUG=0
      - AWS_DEFAULT_REGION=eu-west-1
    volumes:
      - localstack_data:/var/lib/localstack

  # 2. LocalStack Companion (Proxy + Web UI)
  companion:
    image: zorgzp/localstack-companion:latest
    container_name: localstack_companion
    depends_on:
      - localstack
    ports:
      - "4566:4566" # Standard AWS endpoint + Web UI at http://localhost:4566/ui
      - "8080:4566" # Alternative UI port at http://localhost:8080
    environment:
      - LOCALSTACK_URL=http://localstack:4566
      - AWS_DEFAULT_REGION=eu-west-1
      - CONFIG_PATH=/app/resources.yaml
      - AUTO_CREATE_MISSING=false
    volumes:
      - ./resources.yaml:/app/resources.yaml

volumes:
  localstack_data:
```

### Create a baseline `resources.yaml`:

In the same directory, create a minimal `resources.yaml`:

```yaml
version: "1.0"

services:
  s3:
    buckets:
      - name: my-test-bucket
        acl: private
  sqs:
    queues:
      - name: my-events-queue
        attributes:
          VisibilityTimeout: "30"
  dynamodb:
    tables:
      - tableName: items
        partitionKey:
          name: id
          type: S
        billingMode: PAY_PER_REQUEST
```

### Start the stack:

```bash
docker compose up -d
```
*(or `docker-compose up -d`)*

---

## 🖥️ Accessing the Web UI

Open your browser:
* 👉 **[http://localhost:4566/ui](http://localhost:4566/ui)** (or [http://localhost:8080](http://localhost:8080))

---

## ⚙️ Connecting Your Application

Point your Spring Boot `application.yml` or AWS SDK client to port `4566`:

```yaml
spring:
  cloud:
    aws:
      endpoint: http://localhost:4566
      region:
        static: eu-west-1
      credentials:
        access-key: test
        secret-key: test
      s3:
        endpoint: http://localhost:4566
        path-style-access-enabled: true
      sqs:
        endpoint: http://localhost:4566
      dynamodb:
        endpoint: http://localhost:4566
```

---

## ✨ Key Features

1. **Declarative Baseline (`resources.yaml`)**: Automatically provisions S3 buckets, SQS queues, SNS topics, DynamoDB tables, Secrets Manager secrets, and SSM parameters upon container startup.
2. **Missing Resource Self-Healing**: When your app makes a call to an unprovisioned queue, bucket, or table, Companion intercepts the `QueueDoesNotExist` / `NoSuchBucket` / `ResourceNotFoundException` error and prompts you in the UI to **"Provision & Add to YAML"** with 1 click.
3. **Interactive Resource Manager**:
   * **SQS**: Push test JSON/text messages, view message queue depth, peek in-flight messages, and purge queues.
   * **S3**: Upload files, inspect bucket contents, preview files inline, and delete objects.
   * **DynamoDB**: Scan records and insert JSON items.
   * **Secrets Manager & SSM**: Edit secret strings and parameters with reveal/mask toggles.
4. **Live Traffic Inspector**: Real-time streaming log of all AWS API requests with method names, HTTP status codes, latency, and payloads.
5. **Auto-Create Mode**: Optional toggle (`AUTO_CREATE_MISSING=true`) to automatically create missing resources on-the-fly without manual approval.

---

## 📄 Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `LOCALSTACK_URL` | `http://localstack:4566` | The URL of the target LocalStack Core instance. |
| `AWS_DEFAULT_REGION` | `eu-west-1` | Default AWS region. |
| `CONFIG_PATH` | `/app/resources.yaml` | Path to the declarative baseline YAML configuration. |
| `AUTO_CREATE_MISSING` | `false` | When `true`, automatically provisions missing resources without prompting. |
