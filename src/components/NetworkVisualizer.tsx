import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export const NetworkVisualizer: React.FC = () => {
  const [data, setData] = useState<{ value: number }[]>(Array.from({ length: 20 }, () => ({ value: 0 })));
  const [ips, setIps] = useState(0);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/core-api/status');
        if (response.ok) {
          const data = await response.json();
          const currentIps = data.ips || 0;
          setIps(currentIps);
          setData(prev => [...prev.slice(1), { value: Math.min(100, (currentIps / 5000) * 100) }]);
        }
      } catch (err) {}
    };

    const interval = setInterval(fetchStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-8 bg-black/20 rounded-lg overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] font-mono text-purple-400 font-bold leading-none">{ips}</span>
        <span className="text-[7px] font-mono text-purple-500/60 uppercase leading-none">IPS</span>
      </div>
    </div>
  );
};
