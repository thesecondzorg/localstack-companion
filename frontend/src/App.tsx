import React, { useState, useEffect } from 'react';
import { ActiveResources, MissingResourceEvent, TrafficLog } from './types';
import {
  fetchHealth,
  fetchResources,
  fetchPendingRequests,
  approvePendingRequest,
  dismissPendingRequest,
  syncResources,
  toggleAutoCreate,
  deleteResource,
} from './services/api';
import { wsClient } from './services/websocket';
import { Navbar } from './components/Navbar';
import { ResourceDashboard } from './components/ResourceDashboard';
import { PendingRequests } from './components/PendingRequestsModal';
import { TrafficInspector } from './components/TrafficInspector';
import { YamlViewer } from './components/YamlViewer';
import { SpringGuideModal } from './components/SpringGuideModal';
import { CreateResourceModal } from './components/CreateResourceModal';
import { ResourceActionModal } from './components/ResourceActionModal';

export function App() {
  const [activeTab, setActiveTab] = useState('resources');
  const [health, setHealth] = useState<any>(null);
  const [resources, setResources] = useState<ActiveResources>({
    s3: [],
    sqs: [],
    sns: [],
    dynamodb: [],
    secretsmanager: [],
    ssm: [],
    kms: [],
  });
  const [pendingRequests, setPendingRequests] = useState<MissingResourceEvent[]>([]);
  const [trafficLogs, setTrafficLogs] = useState<TrafficLog[]>([]);
  const [autoCreate, setAutoCreate] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createService, setCreateService] = useState('sqs');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Action / Data Modal
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [selectedService, setSelectedService] = useState('sqs');
  const [selectedResource, setSelectedResource] = useState('');

  // Initial Data Fetch & WebSocket Setup
  useEffect(() => {
    // 1. Fetch snapshot
    fetchHealth().then(setHealth).catch(console.error);
    fetchResources().then((res) => {
      if (res && res.active) setResources(res.active);
    }).catch(console.error);
    fetchPendingRequests().then((res) => {
      if (Array.isArray(res)) setPendingRequests(res);
    }).catch(console.error);

    // 2. Connect WebSocket
    wsClient.connect();

    const unsubscribe = wsClient.subscribe((type, data) => {
      console.log('[WS Event]', type, data);
      if (type === 'INITIAL_STATE') {
        if (data.activeResources) setResources(data.activeResources);
        if (data.pendingRequests) setPendingRequests(data.pendingRequests);
        if (data.trafficHistory) setTrafficLogs(data.trafficHistory);
        if (data.health) setHealth({ status: 'UP', localstack: data.health });
        if (data.settings?.autoCreate !== undefined) setAutoCreate(data.settings.autoCreate);
      } else if (type === 'MISSING_RESOURCE') {
        setPendingRequests((prev) => {
          if (prev.some((p) => p.id === data.id)) return prev;
          return [data, ...prev];
        });
      } else if (type === 'TRAFFIC_LOG') {
        setTrafficLogs((prev) => [data, ...prev.slice(0, 99)]);
      } else if (type === 'RESOURCES_UPDATED') {
        setResources(data);
      } else if (type === 'RESOURCE_APPROVED' || type === 'RESOURCE_DISMISSED') {
        setPendingRequests((prev) => prev.filter((p) => p.id !== data.eventId));
      } else if (type === 'HEALTH_CHANGED') {
        if (data) setHealth(data);
      } else if (type === 'SETTINGS_CHANGED') {
        if (data.autoCreate !== undefined) setAutoCreate(data.autoCreate);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleApprove = async (eventId: string, customSpec?: any) => {
    try {
      await approvePendingRequest(eventId, customSpec);
      setPendingRequests((prev) => prev.filter((p) => p.id !== eventId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismiss = async (eventId: string) => {
    try {
      await dismissPendingRequest(eventId);
      setPendingRequests((prev) => prev.filter((p) => p.id !== eventId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncResources();
      if (res && res.active) setResources(res.active);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleAutoCreate = async (enabled: boolean) => {
    setAutoCreate(enabled);
    try {
      await toggleAutoCreate(enabled);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCreateForService = (srv: string) => {
    setCreateService(srv);
    setIsCreateOpen(true);
  };

  const handleItemClick = (service: string, resourceName: string) => {
    setSelectedService(service);
    setSelectedResource(resourceName);
    setIsActionOpen(true);
  };

  const handleDeleteResource = async (service: string, resourceName: string) => {
    if (confirm(`Are you sure you want to delete ${service} resource '${resourceName}' from LocalStack and resources.yaml?`)) {
      try {
        const res = await deleteResource(service, resourceName, true);
        if (res && res.active) setResources(res.active);
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingRequests.length}
        health={health}
        autoCreate={autoCreate}
        onToggleAutoCreate={handleToggleAutoCreate}
        onSync={handleSync}
        isSyncing={isSyncing}
        onOpenCreate={() => {
          setCreateService('sqs');
          setIsCreateOpen(true);
        }}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'resources' && (
          <ResourceDashboard
            resources={resources}
            onOpenCreateForService={handleOpenCreateForService}
            onItemClick={handleItemClick}
            onDeleteClick={handleDeleteResource}
          />
        )}

        {activeTab === 'pending' && (
          <PendingRequests
            pendingRequests={pendingRequests}
            onApprove={handleApprove}
            onDismiss={handleDismiss}
          />
        )}

        {activeTab === 'traffic' && (
          <TrafficInspector
            logs={trafficLogs}
            onClear={() => setTrafficLogs([])}
          />
        )}

        {activeTab === 'yaml' && <YamlViewer />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        LocalStack Resource Companion • Transparent AWS Proxy on <code className="text-amber-600 font-mono">:4566</code> • Region: <code className="text-amber-600 font-mono">eu-west-1</code>
      </footer>

      {/* Modals */}
      <SpringGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <CreateResourceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        defaultService={createService}
        onCreated={() => {
          fetchResources().then((r) => r.active && setResources(r.active));
        }}
      />
      <ResourceActionModal
        isOpen={isActionOpen}
        onClose={() => setIsActionOpen(false)}
        service={selectedService}
        resourceName={selectedResource}
        onActionComplete={() => {
          fetchResources().then((r) => r.active && setResources(r.active));
        }}
      />
    </div>
  );
}
export default App;
