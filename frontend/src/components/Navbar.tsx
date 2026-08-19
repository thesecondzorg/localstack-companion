import React from 'react';
import { Cloud, Layers, Activity, FileCode, BookOpen, RefreshCw, Zap, AlertTriangle, Plus } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingCount: number;
  health: { status: string; localstack?: { status: string } } | null;
  autoCreate: boolean;
  onToggleAutoCreate: (enabled: boolean) => void;
  onSync: () => void;
  isSyncing: boolean;
  onOpenCreate: () => void;
  onOpenGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  health,
  autoCreate,
  onToggleAutoCreate,
  onSync,
  isSyncing,
  onOpenCreate,
  onOpenGuide,
}) => {
  const isLocalstackUp = health?.localstack?.status === 'UP';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Row 1 — Brand + Controls */}
        <div className="flex items-center justify-between h-14 gap-4">

          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base tracking-tight text-slate-800 whitespace-nowrap">LocalStack Companion</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-medium whitespace-nowrap">
                  Proxy :4566
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">Dynamic AWS Provisioner for Spring Boot</p>
            </div>
          </div>

          {/* Controls & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Status Pill */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs whitespace-nowrap">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isLocalstackUp ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-600 font-mono">
                {isLocalstackUp ? 'LocalStack Active' : 'Disconnected'}
              </span>
            </div>

            {/* Auto-create switch */}
            <button
              onClick={() => onToggleAutoCreate(!autoCreate)}
              title={autoCreate ? 'Auto-creation is ON' : 'Prompt Mode: approve missing resources'}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${
                autoCreate
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 shrink-0 ${autoCreate ? 'text-emerald-600 fill-emerald-600' : ''}`} />
              <span>Auto-Create: {autoCreate ? 'ON' : 'OFF'}</span>
            </button>

            {/* Sync button */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              title="Reconcile YAML definitions with LocalStack"
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            {/* Create Manual Resource */}
            <button
              onClick={onOpenCreate}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-xs transition shadow-sm whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Add Resource</span>
            </button>

            {/* Spring Boot Guide */}
            <button
              onClick={onOpenGuide}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200 transition"
              title="Spring Boot Configuration Guide"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2 — Navigation Tabs */}
        <div className="flex items-center gap-1 pb-2">
          <button
            onClick={() => setActiveTab('resources')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'resources'
                ? 'bg-amber-500 text-white font-semibold shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>Resources</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-white font-semibold shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Pending Requests</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-rose-500 text-white rounded-full font-bold animate-pulse leading-none">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('traffic')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'traffic'
                ? 'bg-amber-500 text-white font-semibold shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span>Traffic Inspector</span>
          </button>

          <button
            onClick={() => setActiveTab('yaml')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'yaml'
                ? 'bg-amber-500 text-white font-semibold shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <FileCode className="w-4 h-4 shrink-0" />
            <span>resources.yaml</span>
          </button>
        </div>

      </div>
    </header>
  );
};
