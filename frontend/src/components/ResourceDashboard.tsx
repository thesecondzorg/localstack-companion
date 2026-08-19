import React from 'react';
import { ActiveResources } from '../types';
import { ResourceCard } from './ResourceCard';

interface ResourceDashboardProps {
  resources: ActiveResources;
  onOpenCreateForService: (service: string) => void;
  onItemClick: (service: string, resourceName: string) => void;
  onDeleteClick: (service: string, resourceName: string) => void;
}

export const ResourceDashboard: React.FC<ResourceDashboardProps> = ({
  resources,
  onOpenCreateForService,
  onItemClick,
  onDeleteClick,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner — no gradient, plain border */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Active LocalStack AWS Resources (eu-west-1)</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Manage your AWS resources in real time. Click <span className="text-amber-600 font-semibold">Manage</span> to send messages, upload files, or edit data; or click the <span className="text-rose-500 font-semibold">trash icon</span> to remove a resource.
        </p>
      </div>

      {/* Grid of Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ResourceCard
          service="sqs"
          title="SQS Queues"
          items={resources.sqs || []}
          onAddClick={() => onOpenCreateForService('sqs')}
          onItemClick={onItemClick}
          onDeleteClick={onDeleteClick}
        />
        <ResourceCard
          service="s3"
          title="S3 Buckets"
          items={resources.s3 || []}
          onAddClick={() => onOpenCreateForService('s3')}
          onItemClick={onItemClick}
          onDeleteClick={onDeleteClick}
        />
        <ResourceCard
          service="dynamodb"
          title="DynamoDB Tables"
          items={resources.dynamodb || []}
          onAddClick={() => onOpenCreateForService('dynamodb')}
          onItemClick={onItemClick}
          onDeleteClick={onDeleteClick}
        />
        <ResourceCard
          service="sns"
          title="SNS Topics"
          items={resources.sns || []}
          onAddClick={() => onOpenCreateForService('sns')}
          onItemClick={onItemClick}
          onDeleteClick={onDeleteClick}
        />
        <ResourceCard
          service="secretsmanager"
          title="Secrets Manager"
          items={resources.secretsmanager || []}
          onAddClick={() => onOpenCreateForService('secretsmanager')}
          onItemClick={onItemClick}
          onDeleteClick={onDeleteClick}
        />
        <ResourceCard
          service="ssm"
          title="SSM Parameters"
          items={resources.ssm || []}
          onAddClick={() => onOpenCreateForService('ssm')}
          onItemClick={onItemClick}
          onDeleteClick={onDeleteClick}
        />
        <ResourceCard
          service="kms"
          title="KMS Keys"
          items={resources.kms || []}
          onAddClick={() => onOpenCreateForService('kms')}
          onItemClick={onItemClick}
          onDeleteClick={onDeleteClick}
        />
      </div>
    </div>
  );
};
