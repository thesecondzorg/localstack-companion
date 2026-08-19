import React, { useState } from 'react';
import { X, Copy, Check, Terminal } from 'lucide-react';

interface SpringGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpringGuideModal: React.FC<SpringGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copySnippet = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const springYamlSnippet = `# application.yml for Spring Boot (Spring Cloud AWS 3.x)
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
`;

  const awsSdkJavaConfig = `@Configuration
public class AwsClientConfig {

    @Bean
    public SqsClient sqsClient() {
        return SqsClient.builder()
                .endpointOverride(URI.create("http://localhost:4566"))
                .region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create("test", "test")))
                .build();
    }

    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
                .endpointOverride(URI.create("http://localhost:4566"))
                .region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create("test", "test")))
                .forcePathStyle(true)
                .build();
    }
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Spring Boot Setup Guide</h3>
              <p className="text-xs text-slate-400">How to connect your Spring Boot application to LocalStack Companion</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-amber-600">1. Spring Cloud AWS 3.x (`application.yml`)</h4>
              <button
                onClick={() => copySnippet(springYamlSnippet, 'yaml')}
                className="text-xs flex items-center space-x-1 text-slate-400 hover:text-slate-700"
              >
                {copiedKey === 'yaml' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'yaml' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 overflow-x-auto">
              {springYamlSnippet}
            </pre>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-amber-600">2. AWS SDK v2 Java Config (Optional direct beans)</h4>
              <button
                onClick={() => copySnippet(awsSdkJavaConfig, 'java')}
                className="text-xs flex items-center space-x-1 text-slate-400 hover:text-slate-700"
              >
                {copiedKey === 'java' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'java' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 overflow-x-auto">
              {awsSdkJavaConfig}
            </pre>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 text-white font-bold rounded-xl text-xs hover:bg-amber-600 transition"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
