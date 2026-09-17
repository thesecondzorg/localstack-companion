# LocalStack Resource Companion & Dynamic Provisioner

An intelligent wrapper, reverse proxy, and real-time Web UI for **LocalStack** tailored for **Spring Boot & Cloud AWS** development.

> 📖 **Looking for full documentation and visual walkthroughs? Check out the [LocalStack Companion Wiki](WIKI.md) ([docs/WIKI.md](docs/WIKI.md)).**

---

## Key Highlights

- **Declarative Baseline (`resources.yaml`)**: Define S3 buckets, SQS queues, SNS topics, DynamoDB tables, Secrets Manager secrets, SSM parameters, and KMS keys with initial values and attributes. Syncs and provisions automatically on startup.
- **Smart Reverse Proxy (`:4566`)**: Sits transparently in front of LocalStack. Forwards all AWS requests and intercepts `ResourceNotFound` / `404` errors in real time.
- **Real-Time Web UI (`http://localhost:4566/ui` or `:8080`)**:
  - **Resource Dashboard**: Visual cards showing active vs configured resources across AWS services with live message/item counters.
  - **Pending Requests & Action Prompts**: When a Spring Boot application attempts to access an unprovisioned queue, bucket, or table, an instant interactive prompt appears in the UI to **"Provision & Add to YAML"** with 1 click.
  - **Traffic Inspector**: Live feed of all incoming AWS API calls made by your Spring Boot application with status codes, latency, and actions.
  - **YAML Config Editor**: Live preview and editor for `resources.yaml` with automatic reconciliation.
  - **Auto-Create Mode**: Optional toggle to automatically provision missing resources on-the-fly and retry requests so Spring never crashes during local dev.
- **Ready-to-Use Sample App**: Complete Spring Boot 3 demo application ready to run and test.

---

## Architecture Overview

```
                           +-----------------------------------------------+
                           |      LocalStack Resource Companion (:4566)    |
+---------------------+    |                                               |    +----------------------+
|                     |    |  +--------------------+  +-----------------+  |    |                      |
| Spring Boot App     |===>|  | Smart Proxy &      |  | FastAPI REST    |  |===>| LocalStack Core      |
| (aws.endpoint:4566) |    |  | Error Interceptor  |  | & WebSockets    |  |    | (internal :4567)     |
|                     |    |  +--------------------+  +-----------------+  |    |                      |
+---------------------+    |            |                      |           |    +----------------------+
                           |            v                      v           |
                           |   [resources.yaml]        [React Web UI]      |
                           +-----------------------------------------------+
```

---

## Quick Start with Docker Compose

1. Clone or navigate to this repository:
   ```bash
   cd noble-davinci
   ```

2. Start LocalStack and Companion:
   ```bash
   docker compose up --build
   ```

3. Open the Web UI in your browser:
   👉 **[http://localhost:4566/ui](http://localhost:4566/ui)** (or [http://localhost:8080](http://localhost:8080))

---

## Configuring Your Spring Boot Application

Add the following to your Spring Boot `application.yml`:

```yaml
spring:
  cloud:
    aws:
      endpoint: http://localhost:4566
      region:
        static: us-east-1
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
      sns:
        endpoint: http://localhost:4566
```

Or when using AWS SDK v2 clients directly:

```java
@Bean
public SqsClient sqsClient() {
    return SqsClient.builder()
            .endpointOverride(URI.create("http://localhost:4566"))
            .region(Region.US_EAST_1)
            .credentialsProvider(StaticCredentialsProvider.create(
                    AwsBasicCredentials.create("test", "test")))
            .build();
}
```

---

## Declarative YAML Configuration (`resources.yaml`)

You can define baseline resources in `resources.yaml`. When Companion starts, it automatically provisions all resources defined here:

```yaml
version: "1.0"

services:
  s3:
    buckets:
      - name: app-uploads-bucket
        acl: private
      - name: app-documents-bucket
        acl: private

  sqs:
    queues:
      - name: order-events-queue
        attributes:
          VisibilityTimeout: "30"
          MessageRetentionPeriod: "86400"
      - name: user-notifications-queue
        attributes:
          VisibilityTimeout: "30"

  sns:
    topics:
      - name: order-status-topic
        subscriptions:
          - protocol: sqs
            endpoint: order-events-queue

  dynamodb:
    tables:
      - tableName: users
        partitionKey:
          name: userId
          type: S
        sortKey:
          name: createdAt
          type: S
        billingMode: PAY_PER_REQUEST

  secretsmanager:
    secrets:
      - name: /app/database/credentials
        value: '{"username": "postgres", "password": "localpassword123"}'
        description: "Local database credentials"

  ssm:
    parameters:
      - name: /config/app/features/beta_enabled
        type: String
        value: "true"

  kms:
    keys:
      - alias: alias/app-master-key
```

---

## Trying the Sample Spring Boot Application

A complete demo project is included in `sample-spring-app/`:

1. Start the sample Spring application:
   ```bash
   cd sample-spring-app
   mvn spring-boot:run
   ```

2. Test calling a **pre-configured queue**:
   ```bash
   curl -X POST "http://localhost:8090/api/demo/sqs?queue=order-events-queue"
   # Response: {"status":"SUCCESS","queue":"order-events-queue","messageId":"..."}
   ```

3. Test calling a **non-existent queue**:
   ```bash
   curl -X POST "http://localhost:8090/api/demo/sqs?queue=customer-alerts-queue"
   ```

4. Check your Web UI at **`http://localhost:4566/ui`**:
   - You will see a glowing alert under **Pending Requests**:
     > *"Missing Resource: SQS queue `customer-alerts-queue` (Operation: SendMessage)"*
   - Click **"Provision & Add to YAML"**.
   - The queue is immediately created in LocalStack and written into `resources.yaml`.
   - Re-run the curl command; it will now succeed!

---

## Local Development Mode

Run the standalone backend with hot reload (automatically ensures LocalStack Core container is running on `:4567`):

```bash
./run.sh local
```

*(Optional)* Run the Vite frontend dev server with hot reload:
```bash
cd frontend
npm run dev
```
