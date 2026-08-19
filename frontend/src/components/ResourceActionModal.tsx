import React, { useState, useEffect } from 'react';
import {
  X, Send, Upload, Eye, EyeOff, Save, RefreshCw, Trash2, Check, FileText, Database, Plus, AlertTriangle
} from 'lucide-react';
import { deleteResource } from '../services/api';
import {
  sendSqsMessage, fetchSqsMessages, purgeSqsQueue,
  fetchS3Objects, uploadS3Object, fetchS3ObjectContent, deleteS3Object,
  fetchSecretValue, updateSecretValue,
  fetchDynamoItems, insertDynamoItem,
  fetchSsmValue, updateSsmValue,
  publishSnsMessage
} from '../services/api';

interface ResourceActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: string;
  resourceName: string;
  onActionComplete: () => void;
}

export const ResourceActionModal: React.FC<ResourceActionModalProps> = ({
  isOpen,
  onClose,
  service,
  resourceName,
  onActionComplete,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'manage' | 'data' | 'create'>('manage');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // SQS State
  const [sqsMessage, setSqsMessage] = useState('{\n  "event": "ORDER_CREATED",\n  "orderId": "ord-12345",\n  "amount": 99.99\n}');
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]);

  // S3 State
  const [s3Objects, setS3Objects] = useState<any[]>([]);
  const [s3UploadKey, setS3UploadKey] = useState('data.json');
  const [s3UploadContent, setS3UploadContent] = useState('{\n  "message": "Hello from LocalStack S3"\n}');
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  // Secrets Manager State
  const [secretVal, setSecretVal] = useState('');
  const [showSecret, setShowSecret] = useState(true);

  // DynamoDB State
  const [dynamoItems, setDynamoItems] = useState<any[]>([]);
  const [newDynamoItem, setNewDynamoItem] = useState('{\n  "userId": "usr_999",\n  "name": "Jane Smith",\n  "role": "admin"\n}');

  // SSM State
  const [ssmVal, setSsmVal] = useState('');

  // SNS State
  const [snsMsg, setSnsMsg] = useState('{\n  "notification": "User signed in"\n}');

  useEffect(() => {
    if (!isOpen || !resourceName) return;
    setStatusMsg(null);
    setPreviewContent(null);

    if (service === 'sqs') {
      loadSqsMessages();
    } else if (service === 's3') {
      loadS3Objects();
    } else if (service === 'secretsmanager') {
      loadSecret();
    } else if (service === 'dynamodb') {
      loadDynamoItems();
    } else if (service === 'ssm') {
      loadSsm();
    }
  }, [isOpen, service, resourceName]);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  // --- SQS Handlers ---
  const loadSqsMessages = async () => {
    setLoading(true);
    try {
      const msgs = await fetchSqsMessages(resourceName, 10);
      setReceivedMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendSqs = async () => {
    setLoading(true);
    try {
      await sendSqsMessage(resourceName, sqsMessage);
      showStatus('Message sent to SQS queue!');
      onActionComplete();
      await loadSqsMessages();
    } catch (e) {
      showStatus('Failed to send SQS message');
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeSqs = async () => {
    if (!confirm(`Are you sure you want to purge all messages from ${resourceName}?`)) return;
    setLoading(true);
    try {
      await purgeSqsQueue(resourceName);
      setReceivedMessages([]);
      showStatus('Queue purged!');
      onActionComplete();
    } catch (e) {
      showStatus('Failed to purge queue');
    } finally {
      setLoading(false);
    }
  };

  // --- S3 Handlers ---
  const loadS3Objects = async () => {
    setLoading(true);
    try {
      const objs = await fetchS3Objects(resourceName);
      setS3Objects(Array.isArray(objs) ? objs : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadS3 = async () => {
    if (!s3UploadKey.trim()) return;
    setLoading(true);
    try {
      await uploadS3Object(resourceName, s3UploadKey.trim(), s3UploadContent);
      showStatus(`Uploaded ${s3UploadKey} to bucket!`);
      onActionComplete();
      await loadS3Objects();
      setActiveSubTab('data');
    } catch (e) {
      showStatus('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewS3 = async (key: string) => {
    try {
      const res = await fetchS3ObjectContent(resourceName, key);
      setPreviewContent(res.content || '');
    } catch (e) {
      showStatus('Failed to read file');
    }
  };

  const handleDeleteS3 = async (key: string) => {
    try {
      await deleteS3Object(resourceName, key);
      showStatus(`Deleted ${key}`);
      onActionComplete();
      await loadS3Objects();
    } catch (e) {
      showStatus('Delete failed');
    }
  };

  // --- Secrets Manager Handlers ---
  const loadSecret = async () => {
    setLoading(true);
    try {
      const res = await fetchSecretValue(resourceName);
      setSecretVal(res.secretString || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSecret = async () => {
    setLoading(true);
    try {
      await updateSecretValue(resourceName, secretVal, true);
      showStatus('Secret updated in LocalStack and resources.yaml!');
      onActionComplete();
    } catch (e) {
      showStatus('Failed to update secret');
    } finally {
      setLoading(false);
    }
  };

  // --- DynamoDB Handlers ---
  const loadDynamoItems = async () => {
    setLoading(true);
    try {
      const items = await fetchDynamoItems(resourceName);
      setDynamoItems(Array.isArray(items) ? items : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInsertDynamo = async () => {
    setLoading(true);
    try {
      const parsed = JSON.parse(newDynamoItem);
      await insertDynamoItem(resourceName, parsed);
      showStatus('Item inserted into DynamoDB table!');
      onActionComplete();
      await loadDynamoItems();
      setActiveSubTab('data');
    } catch (e) {
      showStatus('Invalid JSON or insert error');
    } finally {
      setLoading(false);
    }
  };

  // --- SSM Handlers ---
  const loadSsm = async () => {
    setLoading(true);
    try {
      const res = await fetchSsmValue(resourceName);
      setSsmVal(res.value || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSsm = async () => {
    setLoading(true);
    try {
      await updateSsmValue(resourceName, ssmVal, true);
      showStatus('Parameter updated in LocalStack & resources.yaml!');
      onActionComplete();
    } catch (e) {
      showStatus('Failed to update parameter');
    } finally {
      setLoading(false);
    }
  };

  // --- SNS Handler ---
  const handlePublishSns = async () => {
    setLoading(true);
    try {
      await publishSnsMessage(resourceName, snsMsg);
      showStatus('Message published to SNS topic!');
      onActionComplete();
    } catch (e) {
      showStatus('Publish failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl flex flex-col max-h-[85vh]">

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                {service}
              </span>
              <h3 className="text-base font-bold text-slate-800 font-mono">{resourceName}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Interactive Resource Manager & Data Editor</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-white text-xs">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveSubTab('manage')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeSubTab === 'manage' ? 'bg-amber-500 text-white font-bold' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {service === 'sqs' ? 'Send Message' : service === 's3' ? 'Upload File' : service === 'sns' ? 'Publish' : 'Edit Value'}
            </button>
            {(service === 'sqs' || service === 's3' || service === 'dynamodb') && (
              <button
                onClick={() => setActiveSubTab('data')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  activeSubTab === 'data' ? 'bg-amber-500 text-white font-bold' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                {service === 'sqs' ? `Messages (${receivedMessages.length})` : service === 's3' ? `Objects (${s3Objects.length})` : `Items (${dynamoItems.length})`}
              </button>
            )}
            {service === 'dynamodb' && (
              <button
                onClick={() => setActiveSubTab('create')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  activeSubTab === 'create' ? 'bg-amber-500 text-white font-bold' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                + Insert Item
              </button>
            )}
          </div>

          {statusMsg && (
            <span className="text-emerald-600 font-semibold flex items-center space-x-1 animate-pulse">
              <Check className="w-3.5 h-3.5" />
              <span>{statusMsg}</span>
            </span>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">

          {/* ===================== SQS PANEL ===================== */}
          {service === 'sqs' && activeSubTab === 'manage' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500">Message Body (JSON or Plain Text)</label>
              <textarea
                value={sqsMessage}
                onChange={(e) => setSqsMessage(e.target.value)}
                rows={8}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-700 outline-none focus:border-amber-400"
              />
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={handleSendSqs}
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{loading ? 'Sending...' : 'Push to SQS Queue'}</span>
                </button>
              </div>
            </div>
          )}

          {service === 'sqs' && activeSubTab === 'data' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Peek recent messages:</span>
                <div className="flex space-x-2">
                  <button onClick={loadSqsMessages} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs flex items-center space-x-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                  <button onClick={handlePurgeSqs} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs flex items-center space-x-1">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purge</span>
                  </button>
                </div>
              </div>
              {receivedMessages.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  No messages currently visible in queue.
                </div>
              ) : (
                <div className="space-y-2">
                  {receivedMessages.map((m, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
                      <div className="text-[10px] text-slate-400 mb-1">ID: {m.messageId}</div>
                      <pre className="text-slate-700 whitespace-pre-wrap">{m.body}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===================== S3 PANEL ===================== */}
          {service === 's3' && activeSubTab === 'manage' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Object Key / File Path</label>
                <input
                  type="text"
                  value={s3UploadKey}
                  onChange={(e) => setS3UploadKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:border-amber-400"
                  placeholder="e.g. documents/invoice-001.json"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">File Content</label>
                <textarea
                  value={s3UploadContent}
                  onChange={(e) => setS3UploadContent(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-700 outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleUploadS3}
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{loading ? 'Uploading...' : 'Upload to S3 Bucket'}</span>
                </button>
              </div>
            </div>
          )}

          {service === 's3' && activeSubTab === 'data' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Objects in bucket:</span>
                <button onClick={loadS3Objects} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs flex items-center space-x-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
              {s3Objects.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  Bucket is empty. Upload a file above.
                </div>
              ) : (
                <div className="space-y-2">
                  {s3Objects.map((obj, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-amber-500" />
                        <span className="font-mono text-slate-700 font-semibold">{obj.key}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({obj.size} bytes)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePreviewS3(obj.key)}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded text-[11px]"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteS3(obj.key)}
                          className="p-1 text-rose-500 hover:text-rose-600 rounded hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {previewContent !== null && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-amber-200 text-xs font-mono">
                  <div className="text-[10px] text-amber-600 font-bold uppercase mb-1">File Preview:</div>
                  <pre className="text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">{previewContent}</pre>
                </div>
              )}
            </div>
          )}

          {/* ===================== SECRETS MANAGER PANEL ===================== */}
          {service === 'secretsmanager' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500">Secret Value (JSON or Plain String)</label>
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-xs text-slate-400 hover:text-slate-700 flex items-center space-x-1"
                >
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showSecret ? 'Hide' : 'Reveal'}</span>
                </button>
              </div>
              <textarea
                value={secretVal}
                onChange={(e) => setSecretVal(e.target.value)}
                rows={10}
                className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-700 outline-none focus:border-amber-400 ${
                  !showSecret ? 'filter blur-sm select-none' : ''
                }`}
              />
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveSecret}
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? 'Saving...' : 'Save & Update in resources.yaml'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================== DYNAMODB PANEL ===================== */}
          {service === 'dynamodb' && activeSubTab === 'data' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Scanned items ({dynamoItems.length}):</span>
                <button onClick={loadDynamoItems} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs flex items-center space-x-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
              {dynamoItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  No records in table. Click "+ Insert Item" to add data.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {dynamoItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
                      <pre className="text-slate-700 whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {service === 'dynamodb' && (activeSubTab === 'manage' || activeSubTab === 'create') && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500">Insert Item (JSON Object)</label>
              <textarea
                value={newDynamoItem}
                onChange={(e) => setNewDynamoItem(e.target.value)}
                rows={8}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-700 outline-none focus:border-amber-400"
              />
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleInsertDynamo}
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{loading ? 'Inserting...' : 'Put Item into Table'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================== SSM PANEL ===================== */}
          {service === 'ssm' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500">Parameter Value</label>
              <textarea
                value={ssmVal}
                onChange={(e) => setSsmVal(e.target.value)}
                rows={6}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-700 outline-none focus:border-amber-400"
              />
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveSsm}
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? 'Saving...' : 'Save & Update in resources.yaml'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================== SNS PANEL ===================== */}
          {service === 'sns' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500">Notification Message Payload</label>
              <textarea
                value={snsMsg}
                onChange={(e) => setSnsMsg(e.target.value)}
                rows={8}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-700 outline-none focus:border-amber-400"
              />
              <div className="flex justify-end pt-2">
                <button
                  onClick={handlePublishSns}
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{loading ? 'Publishing...' : 'Publish to SNS Topic'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <div className="flex items-center justify-between w-full">
            <button
              onClick={async () => {
                if (confirm(`Are you sure you want to delete ${resourceName} from LocalStack and resources.yaml?`)) {
                  await deleteResource(service, resourceName, true);
                  onActionComplete();
                  onClose();
                }
              }}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Resource</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl text-xs font-medium transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
