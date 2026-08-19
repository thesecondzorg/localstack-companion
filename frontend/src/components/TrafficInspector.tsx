import React, { useState } from 'react';
import { TrafficLog } from '../types';
import { Activity, Search, Trash2 } from 'lucide-react';

interface TrafficInspectorProps {
  logs: TrafficLog[];
  onClear: () => void;
}

export const TrafficInspector: React.FC<TrafficInspectorProps> = ({ logs, onClear }) => {
  const [filter, setFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');

  const filteredLogs = logs.filter((l) => {
    const matchesText =
      l.path.toLowerCase().includes(filter.toLowerCase()) ||
      l.action.toLowerCase().includes(filter.toLowerCase()) ||
      (l.missing_resource && l.missing_resource.toLowerCase().includes(filter.toLowerCase()));
    const matchesService = serviceFilter === 'ALL' || l.service.toLowerCase() === serviceFilter.toLowerCase();
    return matchesText && matchesService;
  });

  return (
    <div className="space-y-4">
      {/* Filters & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <Activity className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold text-slate-800">Live AWS API Traffic</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono">
            {logs.length} requests
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Service Dropdown */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="bg-white border border-slate-200 text-xs text-slate-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">All Services</option>
            <option value="s3">S3</option>
            <option value="sqs">SQS</option>
            <option value="sns">SNS</option>
            <option value="dynamodb">DynamoDB</option>
            <option value="secretsmanager">Secrets Manager</option>
            <option value="ssm">SSM</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter actions or paths..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white border border-slate-200 text-xs text-slate-700 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-amber-400 w-48"
            />
          </div>

          {/* Clear */}
          <button
            onClick={onClear}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg border border-slate-200 transition"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log Feed Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-sans">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Time</th>
                <th className="py-2.5 px-4 font-semibold">Service</th>
                <th className="py-2.5 px-4 font-semibold">Method & Action</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold">Duration</th>
                <th className="py-2.5 px-4 font-semibold">Resource / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    No matching requests. Send AWS API calls to <code className="text-amber-600">http://localhost:4566</code>.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const is404 = log.status_code === 404 || log.is_error;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 text-slate-400">{log.timestamp}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-bold uppercase">
                          {log.service}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">
                        <span className="text-amber-600 font-bold mr-1.5">{log.method}</span>
                        <span>{log.action}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            log.status_code >= 200 && log.status_code < 300
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : log.status_code >= 400 && log.status_code < 500
                              ? 'bg-rose-50 text-rose-600 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {log.status_code}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{log.duration_ms} ms</td>
                      <td className="py-2.5 px-4">
                        {log.missing_resource ? (
                          <span className="text-rose-500 font-semibold flex items-center space-x-1">
                            <span>Missing: {log.missing_resource}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 truncate max-w-xs block">{log.path}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
