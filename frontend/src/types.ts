export interface MissingResourceEvent {
  id: string;
  timestamp: string;
  service: string;
  resource_type: string;
  resource_name: string;
  operation: string;
  error_code?: string;
  error_message?: string;
  suggested_spec: Record<string, any>;
  status: 'PENDING' | 'CREATED' | 'DISMISSED';
  client_info?: {
    client_host?: string;
    method?: string;
    path?: string;
  };
}

export interface TrafficLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  service: string;
  action: string;
  status_code: number;
  duration_ms: number;
  is_error: boolean;
  missing_resource?: string;
}

export interface ActiveResources {
  s3: Array<{ name: string; creationDate?: string; objectCount?: number }>;
  sqs: Array<{ name: string; url?: string; messages?: string; visibilityTimeout?: string }>;
  sns: Array<{ name: string; arn?: string; subscriptionsCount?: number }>;
  dynamodb: Array<{ tableName: string; status?: string; itemCount?: number; keys?: string[] }>;
  secretsmanager: Array<{ name: string; description?: string }>;
  ssm: Array<{ name: string; type?: string; description?: string }>;
  kms: Array<{ alias?: string; targetKeyId?: string }>;
}

export interface AppConfig {
  version: string;
  services: {
    s3?: { buckets?: any[] };
    sqs?: { queues?: any[] };
    sns?: { topics?: any[] };
    dynamodb?: { tables?: any[] };
    secretsmanager?: { secrets?: any[] };
    ssm?: { parameters?: any[] };
    kms?: { keys?: any[] };
  };
}
