import React from 'react';
import { MissingResourceEvent } from '../types';
import { AlertTriangle, Check, X, ArrowRight } from 'lucide-react';

interface PendingRequestsProps {
  pendingRequests: MissingResourceEvent[];
  onApprove: (eventId: string, spec?: any) => void;
  onDismiss: (eventId: string) => void;
}

export const PendingRequests: React.FC<PendingRequestsProps> = ({
  pendingRequests,
  onApprove,
  onDismiss,
}) => {
  if (pendingRequests.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
          <Check className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">No Pending Resource Requests</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
          Your Spring Boot application has not requested any missing AWS resources.
          When your app tries to access a non-existent queue, bucket, or table, it will show up here immediately.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-6 h-6 text-rose-500 animate-bounce" />
          <div>
            <h3 className="text-sm font-bold text-rose-700">
              {pendingRequests.length} Missing Resource {pendingRequests.length === 1 ? 'Request' : 'Requests'} Detected
            </h3>
            <p className="text-xs text-slate-500">
              Spring Boot attempted to perform operations on resources that do not exist yet.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {pendingRequests.map((req) => (
          <div
            key={req.id}
            className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm relative overflow-hidden"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left Details */}
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                    {req.service}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{req.timestamp}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 font-mono">
                    {req.error_code || '404 Not Found'}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-slate-800 font-mono">{req.resource_name}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Operation: <code className="text-amber-600 font-mono">{req.operation}</code></span>
                </div>

                <p className="text-xs text-slate-500">
                  {req.error_message || 'LocalStack reported resource does not exist.'}
                </p>

                {/* Predefined / Suggested attributes */}
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-600">
                  <div className="text-[10px] text-slate-400 uppercase font-sans font-bold mb-1">
                    Suggested Configuration (Will be added to resources.yaml):
                  </div>
                  <pre className="text-emerald-700">{JSON.stringify(req.suggested_spec, null, 2)}</pre>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-row md:flex-col gap-2 justify-end min-w-[200px]">
                <button
                  onClick={() => onApprove(req.id)}
                  className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Provision & Add to YAML</span>
                </button>
                <button
                  onClick={() => onDismiss(req.id)}
                  className="flex items-center justify-center space-x-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-medium transition border border-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Dismiss</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
