const API_BASE = window.location.port === '3000' ? '' : '';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}

export async function fetchResources() {
  const res = await fetch(`${API_BASE}/api/resources`);
  return res.json();
}

export async function syncResources() {
  const res = await fetch(`${API_BASE}/api/resources/sync`, { method: 'POST' });
  return res.json();
}

export async function fetchConfigYaml() {
  const res = await fetch(`${API_BASE}/api/config/yaml`);
  return res.json();
}

export async function updateConfigYaml(yaml: string) {
  const res = await fetch(`${API_BASE}/api/config/yaml`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml })
  });
  return res.json();
}

export async function fetchPendingRequests() {
  const res = await fetch(`${API_BASE}/api/pending-requests`);
  return res.json();
}

export async function approvePendingRequest(eventId: string, customSpec?: any) {
  const res = await fetch(`${API_BASE}/api/pending-requests/${eventId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customSpec || {})
  });
  return res.json();
}

export async function dismissPendingRequest(eventId: string) {
  const res = await fetch(`${API_BASE}/api/pending-requests/${eventId}/dismiss`, {
    method: 'POST'
  });
  return res.json();
}

export async function createManualResource(service: string, resource_type: string, spec: any, addToConfig = true) {
  const res = await fetch(`${API_BASE}/api/resources/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, resource_type, spec, add_to_config: addToConfig })
  });
  return res.json();
}

export async function toggleAutoCreate(enabled: boolean) {
  const res = await fetch(`${API_BASE}/api/settings/auto-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  });
  return res.json();
}

// --- Interactive SQS Actions ---
export async function sendSqsMessage(queueName: string, message: string, attributes?: any) {
  const res = await fetch(`${API_BASE}/api/sqs/${encodeURIComponent(queueName)}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, attributes })
  });
  return res.json();
}

export async function fetchSqsMessages(queueName: string, maxMessages = 10) {
  const res = await fetch(`${API_BASE}/api/sqs/${encodeURIComponent(queueName)}/messages?max_messages=${maxMessages}`);
  return res.json();
}

export async function purgeSqsQueue(queueName: string) {
  const res = await fetch(`${API_BASE}/api/sqs/${encodeURIComponent(queueName)}/purge`, {
    method: 'POST'
  });
  return res.json();
}

// --- Interactive S3 Actions ---
export async function fetchS3Objects(bucketName: string) {
  const res = await fetch(`${API_BASE}/api/s3/${encodeURIComponent(bucketName)}/objects`);
  return res.json();
}

export async function uploadS3Object(bucketName: string, key: string, content: string, contentType = 'text/plain') {
  const res = await fetch(`${API_BASE}/api/s3/${encodeURIComponent(bucketName)}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, content, contentType })
  });
  return res.json();
}

export async function fetchS3ObjectContent(bucketName: string, key: string) {
  const res = await fetch(`${API_BASE}/api/s3/${encodeURIComponent(bucketName)}/objects/${encodeURIComponent(key)}`);
  return res.json();
}

export async function deleteS3Object(bucketName: string, key: string) {
  const res = await fetch(`${API_BASE}/api/s3/${encodeURIComponent(bucketName)}/objects/${encodeURIComponent(key)}`, {
    method: 'DELETE'
  });
  return res.json();
}

// --- Interactive Secrets Manager Actions ---
export async function fetchSecretValue(secretName: string) {
  const res = await fetch(`${API_BASE}/api/secrets/${encodeURIComponent(secretName)}/value`);
  return res.json();
}

export async function updateSecretValue(secretName: string, value: string, updateConfig = true) {
  const res = await fetch(`${API_BASE}/api/secrets/${encodeURIComponent(secretName)}/value`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, updateConfig })
  });
  return res.json();
}

// --- Interactive DynamoDB Actions ---
export async function fetchDynamoItems(tableName: string) {
  const res = await fetch(`${API_BASE}/api/dynamodb/${encodeURIComponent(tableName)}/items`);
  return res.json();
}

export async function insertDynamoItem(tableName: string, item: any) {
  const res = await fetch(`${API_BASE}/api/dynamodb/${encodeURIComponent(tableName)}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item })
  });
  return res.json();
}

// --- Interactive SSM Parameter Store Actions ---
export async function fetchSsmValue(paramName: string) {
  const res = await fetch(`${API_BASE}/api/ssm/${encodeURIComponent(paramName)}/value`);
  return res.json();
}

export async function updateSsmValue(paramName: string, value: string, updateConfig = true) {
  const res = await fetch(`${API_BASE}/api/ssm/${encodeURIComponent(paramName)}/value`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, updateConfig })
  });
  return res.json();
}

// --- Interactive SNS Actions ---
export async function publishSnsMessage(topicName: string, message: string, subject?: string) {
  const res = await fetch(`${API_BASE}/api/sns/${encodeURIComponent(topicName)}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, subject })
  });
  return res.json();
}

export async function deleteResource(service: string, resourceName: string, removeFromConfig = true) {
  const res = await fetch(`${API_BASE}/api/resources/${encodeURIComponent(service)}/${encodeURIComponent(resourceName)}?remove_from_config=${removeFromConfig}`, {
    method: 'DELETE'
  });
  return res.json();
}
