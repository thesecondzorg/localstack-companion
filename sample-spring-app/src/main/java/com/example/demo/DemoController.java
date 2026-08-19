package com.example.demo;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.GetQueueUrlRequest;
import software.amazon.awssdk.services.sqs.model.SendMessageRequest;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/demo")
public class DemoController {

    private final SqsClient sqsClient;
    private final S3Client s3Client;
    private final DynamoDbClient dynamoDbClient;

    public DemoController(SqsClient sqsClient, S3Client s3Client, DynamoDbClient dynamoDbClient) {
        this.sqsClient = sqsClient;
        this.s3Client = s3Client;
        this.dynamoDbClient = dynamoDbClient;
    }

    /**
     * Test sending to an SQS queue.
     * Example:
     * - Configured queue: /api/demo/sqs?queue=order-events-queue
     * - Non-configured queue: /api/demo/sqs?queue=customer-alerts-queue (Triggers Prompt in UI!)
     */
    @PostMapping("/sqs")
    public ResponseEntity<Map<String, Object>> sendSqsMessage(
            @RequestParam(defaultValue = "order-events-queue") String queue,
            @RequestParam(defaultValue = "Hello from Spring Boot!") String message) {

        Map<String, Object> response = new HashMap<>();
        try {
            String queueUrl = sqsClient.getQueueUrl(GetQueueUrlRequest.builder().queueName(queue).build()).queueUrl();
            var sendResult = sqsClient.sendMessage(SendMessageRequest.builder()
                    .queueUrl(queueUrl)
                    .messageBody(message)
                    .build());
            response.put("status", "SUCCESS");
            response.put("queue", queue);
            response.put("messageId", sendResult.messageId());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("status", "FAILED");
            response.put("queue", queue);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Test uploading a file to an S3 bucket.
     * Example:
     * - Configured bucket: /api/demo/s3?bucket=app-uploads-bucket
     * - Non-configured bucket: /api/demo/s3?bucket=customer-invoices (Triggers Prompt in UI!)
     */
    @PostMapping("/s3")
    public ResponseEntity<Map<String, Object>> uploadS3Object(
            @RequestParam(defaultValue = "app-uploads-bucket") String bucket,
            @RequestParam(defaultValue = "test-document.txt") String key,
            @RequestParam(defaultValue = "Sample payload uploaded via Spring") String content) {

        Map<String, Object> response = new HashMap<>();
        try {
            s3Client.putObject(
                    PutObjectRequest.builder().bucket(bucket).key(key).build(),
                    RequestBody.fromBytes(content.getBytes(StandardCharsets.UTF_8))
            );
            response.put("status", "SUCCESS");
            response.put("bucket", bucket);
            response.put("key", key);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("status", "FAILED");
            response.put("bucket", bucket);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Test saving an item to DynamoDB table.
     * Example:
     * - Configured table: /api/demo/dynamodb?table=users
     * - Non-configured table: /api/demo/dynamodb?table=products (Triggers Prompt in UI!)
     */
    @PostMapping("/dynamodb")
    public ResponseEntity<Map<String, Object>> saveDynamoDbItem(
            @RequestParam(defaultValue = "users") String table,
            @RequestParam(defaultValue = "user-101") String id) {

        Map<String, Object> response = new HashMap<>();
        try {
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("userId", AttributeValue.builder().s(id).build());
            item.put("createdAt", AttributeValue.builder().s(Instant.now().toString()).build());
            item.put("name", AttributeValue.builder().s("John Doe").build());

            dynamoDbClient.putItem(PutItemRequest.builder().tableName(table).item(item).build());
            response.put("status", "SUCCESS");
            response.put("table", table);
            response.put("item", id);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("status", "FAILED");
            response.put("table", table);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
}
