import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface NetworkStatsChartProps {
  data?: any[];
}

export const NetworkStatsChart: React.FC<NetworkStatsChartProps> = ({ data }) => {
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;
    
    // Generate some placeholder data if none provided
    return Array.from({ length: 20 }, (_, i) => ({
      time: i,
      download: Math.floor(Math.random() * 100) + 50,
      upload: Math.floor(Math.random() * 50) + 10,
    }));
  }, [data]);

  return (
    <div className="w-full h-full min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis 
            dataKey="time" 
            hide 
          />
          <YAxis 
            hide 
            domain={[0, 'auto']} 
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
            itemStyle={{ fontSize: '12px' }}
          />
          <Area 
            type="monotone" 
            dataKey="download" 
            stroke="#3b82f6" 
            fillOpacity={1} 
            fill="url(#colorDownload)" 
            isAnimationActive={false}
          />
          <Area 
            type="monotone" 
            dataKey="upload" 
            stroke="#10b981" 
            fillOpacity={1} 
            fill="url(#colorUpload)" 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
