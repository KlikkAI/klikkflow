/**
 * Version Distribution Chart
 * Visualize instance distribution across versions
 */

import { Card, Empty, Skeleton } from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { InstanceStatisticsSummary } from '@/core/types/admin';

interface VersionDistributionChartProps {
  statistics: InstanceStatisticsSummary | null;
  isLoading?: boolean;
}

/**
 * Version distribution chart component
 */
export const VersionDistributionChart: React.FC<VersionDistributionChartProps> = ({
  statistics,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card title="Version Distribution">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (!statistics?.byVersion) {
    return (
      <Card title="Version Distribution">
        <Empty description="No data available" />
      </Card>
    );
  }

  // Transform data for Recharts
  const data = Object.entries(statistics.byVersion)
    .filter(([_, count]) => count > 0)
    .map(([version, count]) => ({
      version,
      count,
    }))
    .sort((a, b) => {
      // Sort versions in descending order (newest first)
      const versionA = a.version.split('.').map(Number);
      const versionB = b.version.split('.').map(Number);

      for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
        const numA = versionA[i] || 0;
        const numB = versionB[i] || 0;
        if (numA !== numB) {
          return numB - numA;
        }
      }
      return 0;
    });

  if (data.length === 0) {
    return (
      <Card title="Version Distribution">
        <Empty description="No instances yet" />
      </Card>
    );
  }

  // Get latest version
  const latestVersion = data[0]?.version;

  return (
    <Card title="Version Distribution" className="h-full">
      <div className="mb-2 text-xs text-gray-500">
        Latest version: <span className="font-semibold text-blue-600">{latestVersion}</span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="version"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
            }}
            formatter={(value: number) => [value, 'Instances']}
          />
          <Legend />
          <Bar dataKey="count" name="Instances" fill="#1890ff" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 text-xs text-gray-500">
        {data.filter((d) => d.version !== latestVersion).length > 0 && (
          <p>{data.filter((d) => d.version !== latestVersion).length} instance(s) need update</p>
        )}
      </div>
    </Card>
  );
};
