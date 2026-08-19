import React from 'react';
import { Database, Folder, Inbox, MessageSquare, Key, Shield, Sliders, CheckCircle2, Trash2 } from 'lucide-react';

interface ResourceCardProps {
  service: string;
  title: string;
  items: any[];
  onAddClick: () => void;
  onItemClick: (service: string, resourceName: string) => void;
  onDeleteClick: (service: string, resourceName: string) => void;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  service,
  title,
  items,
  onAddClick,
  onItemClick,
  onDeleteClick,
}) => {
  const getIcon = () => {
    switch (service) {
      case 's3':
        return <Folder className="w-5 h-5 text-emerald-600" />;
      case 'sqs':
        return <Inbox className="w-5 h-5 text-amber-600" />;
      case 'sns':
        return <MessageSquare className="w-5 h-5 text-rose-500" />;
      case 'dynamodb':
        return <Database className="w-5 h-5 text-blue-600" />;
      case 'secretsmanager':
        return <Key className="w-5 h-5 text-violet-600" />;
      case 'ssm':
        return <Sliders className="w-5 h-5 text-cyan-600" />;
      case 'kms':
        return <Shield className="w-5 h-5 text-indigo-600" />;
      default:
        return <Database className="w-5 h-5 text-slate-500" />;
    }
  };

  const getBorder = () => {
    switch (service) {
      case 's3': return 'border-emerald-200 hover:border-emerald-300';
      case 'sqs': return 'border-amber-200 hover:border-amber-300';
      case 'sns': return 'border-rose-200 hover:border-rose-300';
      case 'dynamodb': return 'border-blue-200 hover:border-blue-300';
      case 'secretsmanager': return 'border-violet-200 hover:border-violet-300';
      case 'ssm': return 'border-cyan-200 hover:border-cyan-300';
      default: return 'border-slate-200 hover:border-slate-300';
    }
  };

  const getIconBg = () => {
    switch (service) {
      case 's3': return 'bg-emerald-50 border-emerald-100';
      case 'sqs': return 'bg-amber-50 border-amber-100';
      case 'sns': return 'bg-rose-50 border-rose-100';
      case 'dynamodb': return 'bg-blue-50 border-blue-100';
      case 'secretsmanager': return 'bg-violet-50 border-violet-100';
      case 'ssm': return 'bg-cyan-50 border-cyan-100';
      case 'kms': return 'bg-indigo-50 border-indigo-100';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className={`bg-white rounded-xl border ${getBorder()} p-5 flex flex-col justify-between transition-all shadow-sm`}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg border ${getIconBg()}`}>
              {getIcon()}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">{title}</h3>
              <p className="text-xs text-slate-400 capitalize">{service} Service</p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Item List */}
        <div className="mt-4 space-y-2 max-h-52 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No active {title.toLowerCase()} provisioned.
            </div>
          ) : (
            items.map((item, idx) => {
              const name = item.name || item.tableName || item.alias || 'unnamed';
              return (
                <div
                  key={idx}
                  className="group flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-amber-300 transition"
                >
                  <div
                    onClick={() => onItemClick(service, name)}
                    className="flex items-center space-x-2.5 overflow-hidden flex-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-xs font-mono text-slate-700 truncate group-hover:text-amber-700">
                      {name}
                    </span>
                  </div>

                  {/* Badges & Actions */}
                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    {item.messages !== undefined && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                        {item.messages} msgs
                      </span>
                    )}
                    {item.itemCount !== undefined && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                        {item.itemCount} items
                      </span>
                    )}
                    {item.subscriptionsCount !== undefined && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 font-mono">
                        {item.subscriptionsCount} subs
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onItemClick(service, name);
                      }}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-800 transition"
                      title="Manage resource data"
                    >
                      Manage
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClick(service, name);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 transition"
                      title="Delete resource from LocalStack & resources.yaml"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Add Button */}
      <button
        onClick={onAddClick}
        className="mt-4 w-full py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-xs text-slate-500 hover:text-slate-700 font-medium transition flex items-center justify-center space-x-1"
      >
        <span>+ Add to {title}</span>
      </button>
    </div>
  );
};
