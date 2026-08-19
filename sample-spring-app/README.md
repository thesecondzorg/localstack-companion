# Sample Spring Boot App with LocalStack Companion

This sample Spring Boot 3 application demonstrates communicating with AWS services (SQS, S3, DynamoDB, SNS) via LocalStack Companion.

## Running the Demo

1. Make sure LocalStack Companion is running on `http://localhost:4566`.
2. Start the Spring Boot application:
   ```bash
   ./mvnw spring-boot:run
   ```
   (or run `DemoApplication` in your IDE)

3. Try calling the configured resources:
   ```bash
   # Configured SQS queue
   curl -X POST "http://localhost:8090/api/demo/sqs?queue=order-events-queue"

   # Configured S3 bucket
   curl -X POST "http://localhost:8090/api/demo/s3?bucket=app-uploads-bucket"

   # Configured DynamoDB table
   curl -X POST "http://localhost:8090/api/demo/dynamodb?table=users"
   ```

4. Try calling **unconfigured / new resources**:
   ```bash
   # Request a new SQS queue!
   curl -X POST "http://localhost:8090/api/demo/sqs?queue=customer-alerts-queue"

   # Request a new S3 bucket!
   curl -X POST "http://localhost:8090/api/demo/s3?bucket=customer-invoices"

   # Request a new DynamoDB table!
   curl -X POST "http://localhost:8090/api/demo/dynamodb?table=products"
   ```

5. Open the Web UI at **`http://localhost:4566/ui`** (or `http://localhost:8080`):
   - You will see the missing resource prompt!
   - Click **"Provision & Add to YAML"**.
   - Re-run the curl command; it will now succeed immediately!
