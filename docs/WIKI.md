# LocalStack Companion Wiki

Welcome to the **LocalStack Companion** documentation and wiki. This guide provides an in-depth walkthrough of the purpose, architecture, visual interfaces, interactive resource tools, and configuration workflows of LocalStack Companion.

---

## 1. Purpose & Motivation

### The Challenge of Local Cloud Development
Developing cloud-native microservices with frameworks like **Spring Boot**, **Quarkus**, **Micronaut**, or Node.js against AWS services locally using [LocalStack](https://localstack.cloud/) is standard practice. However, local workflows typically suffer from several friction points:

1. **Manual Provisioning Boilerplate**: Developers often have to maintain brittle `init-aws.sh` shell scripts, Terraform setups, or custom CLI commands to bootstrap queues, buckets, and tables before their app can even start.
2. **Runtime Failures & Missing Resources**: When a developer adds a new `@SqsListener`, DynamoDB repository, or S3 client call, the application crashes or throws runtime errors (`QueueDoesNotExist`, `NoSuchBucket`, `ResourceNotFoundException`) if the resource was not pre-created.
3. **Lack of Visibility**: Inspecting what messages are inside a local SQS queue, viewing uploaded S3 files, or checking DynamoDB records usually requires running verbose `awslocal` CLI commands.
4. **Disjointed State**: Manual modifications made inside LocalStack are ephemeral and vanish on container restart unless manually codified back into infrastructure files.

### The Solution: LocalStack Companion
**LocalStack Companion** is an intelligent reverse proxy, declarative provisioner, and real-time Web UI designed to sit seamlessly in front of LocalStack. It turns local AWS development into an interactive, self-healing, and observable experience.

```
                                  +-----------------------------------------------+
                                  |      LocalStack Resource Companion (:4566)    |
+---------------------------+     |                                               |     +----------------------+
|                           |     |  +--------------------+  +-----------------+  |     |                      |
| Spring Boot / Cloud Apps  |====>|  | Smart Proxy &      |  | FastAPI REST    |  |====>| LocalStack Core      |
| (aws.endpoint: :4566)     |     |  | Error Interceptor  |  | & WebSockets    |  |     | (internal port :4567)|
|                           |     |  +--------------------+  +-----------------+  |     |                      |
+---------------------------+     |            |                      |           |     +----------------------+
                                  |            v                      v           |
                                  |   [resources.yaml]        [React Web UI]      |
                                  +-----------------------------------------------+
```

---

## 2. Core Architecture & How It Works

LocalStack Companion exposes port `4566` (the standard AWS endpoint port). When your application communicates with LocalStack:

1. **Transparent Proxying**: Requests destined for AWS services (S3, SQS, SNS, DynamoDB, Secrets Manager, SSM, KMS) pass directly through Companion's smart proxy to LocalStack Core.
2. **Error Interception & Detection**: If LocalStack returns a 404 or `ResourceNotFoundException` (such as a missing queue or table), Companion intercepts the error payload, identifies the missing resource, and surfaces it to the Web UI in real time.
3. **Declarative Synchronization**: A single `resources.yaml` file defines your local environment's baseline. When LocalStack starts, Companion ensures all declared resources exist. When you provision or edit resources through the UI, Companion updates `resources.yaml` automatically.
4. **Real-time Reactive UI**: Built with React, Tailwind CSS, and WebSockets, changes in resources, pending requests, and traffic logs are broadcast and updated immediately without manual page refreshes.

---

## 3. Key Features & Visual Guide

### 3.1. Interactive Resource Manager & Data Editor

The **Interactive Resource Manager** modal allows developers to directly interact with, test, and inspect data inside LocalStack resources without leaving the browser.

![Interactive Resource Manager - SQS Message Sender](images/sqs_modal_manager.png)

#### Capabilities per Service:
* **SQS Queues**:
  * **Send Test Messages**: Enter JSON or plain text payloads and push them directly to any active queue with one click.
  * **Message Inspector**: Peek at recent messages waiting in the queue with their Message IDs and timestamps.
  * **Purge Queue**: Clear all accumulated messages in one click.
* **S3 Buckets**:
  * **File Uploads**: Upload JSON, text, or binary files with custom object keys.
  * **Object Browser & File Preview**: Browse files stored in buckets and preview text/JSON contents directly in the modal.
  * **Object Deletion**: Clean up test files individually.
* **DynamoDB Tables**:
  * **Table Scanner**: Scan and view existing table records in formatted JSON.
  * **Insert Item**: Inject test records directly into DynamoDB tables with JSON validation.
* **Secrets Manager & SSM Parameter Store**:
  * **Live Value Editor**: View, toggle visibility (reveal/hide), and edit secret strings or configuration values with instant synchronization to both LocalStack and `resources.yaml`.
* **SNS Topics**:
  * **Publish Notifications**: Broadcast events to test multi-subscriber queues and workflows.

---

### 3.2. Real-Time Resource Dashboard

The main dashboard gives an instant visual overview of all active AWS services in the current region (e.g. `eu-west-1` or `us-east-1`):

```
+---------------------------------------------------------------------------------------------------------+
| (☁) LocalStack Companion  Proxy :4566       ● LocalStack Active   ⚡ Auto-Create: OFF   (⟳)  [+ Add Resource] |
+---------------------------------------------------------------------------------------------------------+
| [Resources]   [Pending Requests (3)]   [Traffic Inspector]   [resources.yaml]                           |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  Active LocalStack AWS Resources (eu-west-1)                                                            |
|  Manage your AWS resources in real time. Click Manage to send messages, upload files, or edit data.     |
|                                                                                                         |
|  +---------------------------+  +---------------------------+  +---------------------------+            |
|  | [SQS Queues]      3 items |  | [S3 Buckets]      0 items |  | [DynamoDB]         1 item |            |
|  |---------------------------|  |---------------------------|  |---------------------------|            |
|  | (✓) test-dge-... [1 msgs] |  | No active S3 buckets      |  | (✓) QuarkusFruits [0 items|            |
|  |     [Manage] [🗑]         |  |                           |  |     [Manage] [🗑]         |            |
|  | (✓) my-queue2    [3 msgs] |  |                           |  |                           |            |
|  |     [Manage] [🗑]         |  |                           |  |                           |            |
|  | (✓) my-queue3    [1 msgs] |  |                           |  |                           |            |
|  |     [Manage] [🗑]         |  |                           |  |                           |            |
|  |   [+ Add to SQS Queues]   |  |   [+ Add to S3 Buckets]   |  |   [+ Add to DynamoDB]     |            |
|  +---------------------------+  +---------------------------+  +---------------------------+            |
|                                                                                                         |
|  +---------------------------+  +---------------------------+  +---------------------------+            |
|  | [SNS Topics]      0 items |  | [Secrets Manager] 0 items |  | [SSM Parameters]  0 items |            |
|  |---------------------------|  |---------------------------|  |---------------------------|            |
|  | No active SNS topics      |  | No active secrets         |  | No active SSM parameters  |            |
|  |   [+ Add to SNS Topics]   |  |   [+ Add to Secrets]      |  |   [+ Add to SSM]          |            |
|  +---------------------------+  +---------------------------+  +---------------------------+            |
+---------------------------------------------------------------------------------------------------------+
```

* **Live Counters**: Cards display real-time message depths for SQS and record counts for DynamoDB.
* **1-Click Creation**: Click `+ Add to <Service>` on any card to create new resources on demand.
* **Deletion & Sync**: Deleting a resource removes it from LocalStack and optionally prunes it from `resources.yaml`.

---

### 3.3. Pending Requests & 1-Click Provisioning

When your application attempts to read or write to an AWS resource that does not yet exist:

1. LocalStack returns a missing resource error.
2. Companion captures the request, extracts the required service and resource name (e.g. queue `customer-alerts-queue`), and adds it to the **Pending Requests** badge.
3. The developer can navigate to **Pending Requests** and click **"Provision & Add to YAML"**.
4. The resource is immediately created in LocalStack and written into `resources.yaml`.
5. Retrying the application request succeeds immediately.

> [!TIP]
> **Auto-Create Mode**: If you toggle **Auto-Create: ON** in the header, Companion will automatically provision missing resources on-the-fly without requiring manual approval, preventing local microservice startup crashes.

---

### 3.4. Real-Time Traffic Inspector

The **Traffic Inspector** tab provides a live streaming feed of all AWS API requests executed against the proxy:
* **Method & Target Service**: Identifies whether a call was `sqs:SendMessage`, `s3:PutObject`, `dynamodb:GetItem`, etc.
* **Resource Identifier**: Shows the exact bucket, queue, or table being targeted.
* **Response Status & Latency**: Displays HTTP response codes and execution time in milliseconds.
* **Payload Inspection**: View the raw request parameters and payloads sent by your application.

---

### 3.5. Live YAML Configuration (`resources.yaml`)

The **resources.yaml** tab in the UI embeds a live editor for the declarative configuration.
* Any edits made in the editor can be saved and reconciled immediately.
* When resources are added or modified through UI action modals, this file stays in perfect sync.

```yaml
version: "1.0"

services:
  s3:
    buckets:
      - name: app-uploads-bucket
        acl: private

  sqs:
    queues:
      - name: order-events-queue
        attributes:
          VisibilityTimeout: "30"
          MessageRetentionPeriod: "86400"

  dynamodb:
    tables:
      - tableName: users
        partitionKey:
          name: userId
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
```

---

## 4. Getting Started

### 4.1. Run with Docker Compose (Recommended)

1. Start LocalStack and Companion:
   ```bash
   docker compose up --build
   ```

2. Open the Web UI:
   👉 **[http://localhost:4566/ui](http://localhost:4566/ui)** (or `http://localhost:8080`)

### 4.2. Application Configuration Example (Spring Boot)

Point your Spring Boot `application.yml` to the Companion endpoint at `http://localhost:4566`:

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

## 5. Summary of Benefits

| Feature | Without Companion | With LocalStack Companion |
| :--- | :--- | :--- |
| **Resource Bootstrap** | Custom shell scripts / `awslocal` commands | Declarative `resources.yaml` auto-sync on startup |
| **Missing Resources** | Application crashes with 404 / `QueueDoesNotExist` | Intercepted with 1-click **"Provision & Add to YAML"** or **Auto-Create** |
| **Data Testing & Injection** | Tedious CLI scripts for SQS send / S3 upload | Rich Web UI to push SQS messages, upload S3 files, scan DynamoDB |
| **Visibility & Observability**| Black-box API requests | Live Traffic Inspector & resource item counters |
| **Config Persistence** | Ephemeral or manual script updates | Bi-directional automatic sync with `resources.yaml` |

---
*LocalStack Companion — Empowering streamlined, observable, and resilient local cloud development.*
