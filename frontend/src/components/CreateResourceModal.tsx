import React, { useState, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { createManualResource } from '../services/api';

interface CreateResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultService?: string;
  onCreated: () => void;
}

export const CreateResourceModal: React.FC<CreateResourceModalProps> = ({
  isOpen,
  onClose,
  defaultService = 'sqs',
  onCreated,
}) => {
  const [service, setService] = useState(defaultService);
  const [name, setName] = useState('');
  const [extraParam, setExtraParam] = useState('');
  const [addToConfig, setAddToConfig] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultService) {
      setService(defaultService);
    }
  }, [defaultService]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      let spec: any = {};
      let resourceType = 'queues';

      if (service === 'sqs') {
        resourceType = 'queues';
        spec = { name: name.trim(), attributes: { VisibilityTimeout: extraParam || '30' } };
      } else if (service === 's3') {
        resourceType = 'buckets';
        spec = { name: name.trim().toLowerCase(), acl: 'private' };
      } else if (service === 'dynamodb') {
        resourceType = 'tables';
        spec = {
          tableName: name.trim(),
          partitionKey: { name: extraParam || 'id', type: 'S' },
          billingMode: 'PAY_PER_REQUEST'
        };
      } else if (service === 'sns') {
        resourceType = 'topics';
        spec = { name: name.trim(), subscriptions: [] };
      } else if (service === 'secretsmanager') {
        resourceType = 'secrets';
        spec = { name: name.trim(), value: extraParam || '{}', description: 'Created via Companion UI' };
      } else if (service === 'ssm') {
        resourceType = 'parameters';
        spec = { name: name.trim(), value: extraParam || 'default', type: 'String' };
      } else if (service === 'kms') {
        resourceType = 'keys';
        spec = { alias: name.startsWith('alias/') ? name : `alias/${name}` };
      }

      await createManualResource(service, resourceType, spec, addToConfig);
      onCreated();
      onClose();
      setName('');
      setExtraParam('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Create AWS Resource</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Service Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">AWS Service</label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-amber-400 font-mono"
            >
              <option value="sqs">SQS (Queue)</option>
              <option value="s3">S3 (Bucket)</option>
              <option value="dynamodb">DynamoDB (Table)</option>
              <option value="sns">SNS (Topic)</option>
              <option value="secretsmanager">Secrets Manager</option>
              <option value="ssm">SSM Parameter Store</option>
              <option value="kms">KMS Key</option>
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              {service === 'dynamodb' ? 'Table Name' : service === 'kms' ? 'Key Alias' : 'Resource Name'}
            </label>
            <input
              type="text"
              required
              placeholder={service === 's3' ? 'e.g. my-app-uploads' : service === 'sqs' ? 'e.g. order-queue' : 'e.g. users'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>

          {/* Extra Param */}
          {service === 'dynamodb' && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Partition Key (String)</label>
              <input
                type="text"
                placeholder="e.g. id or userId (default: id)"
                value={extraParam}
                onChange={(e) => setExtraParam(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
          )}

          {service === 'sqs' && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Visibility Timeout (seconds)</label>
              <input
                type="number"
                placeholder="30"
                value={extraParam}
                onChange={(e) => setExtraParam(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
          )}

          {(service === 'secretsmanager' || service === 'ssm') && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Initial Value</label>
              <input
                type="text"
                placeholder="e.g. secret string or JSON"
                value={extraParam}
                onChange={(e) => setExtraParam(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
          )}

          {/* Add to config checkbox */}
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="addToConfig"
              checked={addToConfig}
              onChange={(e) => setAddToConfig(e.target.checked)}
              className="rounded bg-white border-slate-300 text-amber-500 focus:ring-0"
            />
            <label htmlFor="addToConfig" className="text-xs text-slate-600">
              Save to <code className="text-amber-600">resources.yaml</code> file
            </label>
          </div>

          <div className="pt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition"
            >
              {isSubmitting ? 'Creating...' : 'Create Resource'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
