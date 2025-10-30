/**
 * Platform Distribution Chart
 * Visualize instance distribution across platforms
 */

import { Card, Empty, Skeleton } from 'antd';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { InstancePlatform, InstanceStatisticsSummary } from '@/core/types/admin';

interface PlatformDistributionChartProps {
  statistics: InstanceStatisticsSummary | null;
  isLoading?: boolean;
}

// Platform colors
const PLATFORM_COLORS: Record<InstancePlatform, string> = {
  docker: '#1890ff',
  kubernetes: '#722ed1',
  vps: '#fa8c16',
  cloud: '#13c2c2',
  local: '#52c41a',
};

/**
 * Platform distribution chart component
 */
export const PlatformDistributionChart: React.FC<PlatformDistributionChartProps> = ({
  statistics,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card title="Platform Distribution">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (!statistics?.byPlatform) {
    return (
      <Card title="Platform Distribution">
        <Empty description="No data available" />
      </Card>
    );
  }

  // Transform data for Recharts
  const data = Object.entries(statistics.byPlatform)
    .filter(([_, count]) => count > 0)
    .map(([platform, count]) => ({
      name: platform.toUpperCase(),
      value: count,
      platform: platform as InstancePlatform,
    }));

  if (data.length === 0) {
    return (
      <Card title="Platform Distribution">
        <Empty description="No instances yet" />
      </Card>
    );
  }

  return (
    <Card title="Platform Distribution" className="h-full">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${((percent as number) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={PLATFORM_COLORS[entry.platform]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [value, name]}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
};
