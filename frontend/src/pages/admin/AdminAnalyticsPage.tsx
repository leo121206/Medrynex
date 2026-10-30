import React from 'react';
import { Card } from '../../components/ui/Card';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { auditService } from '../../services/audit.service';
import { useApiCall } from '../../hooks/useApiCall';

interface TrendPoint {
  month: string;
  normal: number;
  emergency: number;
  disputes?: number;
}

export const AdminAnalyticsPage: React.FC = () => {
  const { data: analytics, loading, error, refetch } = useApiCall<{ trend?: TrendPoint[] } | null>(
    async () => {
      const res = await auditService.getAnalytics();
      return (res as { trend?: TrendPoint[] }) || null;
    },
    null
  );

  const trendData = analytics?.trend || [];

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Platform Analytics</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          System-wide usage growth, consent requests, and security distribution.
        </p>
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && trendData.length === 0}
        emptyTitle="No analytics data available"
        emptyMessage="Platform access analytics will populate as audit events are recorded."
        onRetry={refetch}
        skeletonRows={3}
      >
        <Card padding="lg" className="bg-white space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#47634C]">Monthly Access Growth</h3>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <XAxis dataKey="month" stroke="#66736A" fontSize={11} />
                <YAxis stroke="#66736A" fontSize={11} />
                <Tooltip />
                <Bar dataKey="normal" fill="#A8CBA0" name="Normal Access" radius={[4, 4, 0, 0]} />
                <Bar dataKey="emergency" fill="#C85C5C" name="Emergency Break-Glass" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </ApiStateWrapper>
    </div>
  );
};
