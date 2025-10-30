/**
 * Instance Activity Timeline
 * Display recent instance activity events
 */

import {
  CloseCircleOutlined,
  HeartOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Card, Empty, Skeleton, Tag, Timeline } from 'antd';
import type { Instance } from '@/core/types/admin';

interface InstanceActivityTimelineProps {
  instances: Instance[];
  isLoading?: boolean;
  limit?: number;
}

/**
 * Activity timeline component
 */
export const InstanceActivityTimeline: React.FC<InstanceActivityTimelineProps> = ({
  instances,
  isLoading = false,
  limit = 10,
}) => {
  if (isLoading) {
    return (
      <Card title="Recent Activity">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (!instances || instances.length === 0) {
    return (
      <Card title="Recent Activity">
        <Empty description="No activity yet" />
      </Card>
    );
  }

  // Sort by last seen and take the most recent
  const sortedInstances = [...instances]
    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
    .slice(0, limit);

  // Create timeline items
  const timelineItems = sortedInstances.map((instance) => {
    const lastSeen = new Date(instance.lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let timeAgo: string;
    if (diffMinutes < 1) {
      timeAgo = 'Just now';
    } else if (diffMinutes < 60) {
      timeAgo = `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      timeAgo = `${diffHours}h ago`;
    } else if (diffDays < 30) {
      timeAgo = `${diffDays}d ago`;
    } else {
      timeAgo = lastSeen.toLocaleDateString();
    }

    // Determine icon and color based on status
    let icon: React.ReactNode;
    let color: string;
    let label: string;

    if (instance.status === 'active') {
      if (diffMinutes < 5) {
        icon = <PlayCircleOutlined />;
        color = 'green';
        label = 'Instance activated';
      } else {
        icon = <HeartOutlined />;
        color = 'blue';
        label = 'Heartbeat received';
      }
    } else if (instance.status === 'suspended') {
      icon = <CloseCircleOutlined />;
      color = 'red';
      label = 'Instance suspended';
    } else {
      icon = <StopOutlined />;
      color = 'orange';
      label = 'Instance inactive';
    }

    return {
      key: instance.instanceId,
      dot: icon,
      color,
      children: (
        <div>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">{instance.hostname}</span>
              <Tag className="ml-2" color={color}>
                {label}
              </Tag>
            </div>
            <span className="text-xs text-gray-500">{timeAgo}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Version: {instance.version} • Platform: {instance.platform}
          </div>
        </div>
      ),
    };
  });

  return (
    <Card title="Recent Activity" className="h-full">
      <Timeline items={timelineItems} mode="left" />
    </Card>
  );
};
