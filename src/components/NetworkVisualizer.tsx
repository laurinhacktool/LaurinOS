import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export const NetworkVisualizer: React.FC = () => {
  const [data, setData] = useState<{ value: number }[]>(Array.from({ length: 20 }, () => ({ value: 0 })));
  const [ips, setIps] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let pollTimer: NodeJS.Timeout;

    const fetchStatus = async () => {
      if (!isMounted) return;
      try {
        const response = await fetch('/core-api/status');
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            const currentIps = data.ips || 0;
            setIps(currentIps);
            setData(prev => [...prev.slice(1), { value: Math.min(100, (currentIps / 5000) * 100) }]);
          }
        }
      } catch (err) {} finally {
        if (isMounted) {
          pollTimer = setTimeout(fetchStatus, 1500);
        }
      }
    };

    fetchStatus();
    return () => {
      isMounted = false;
      clearTimeout(pollTimer);
    };
  }, []);

  return (
    <div className="flex items-center justify-center">
      <div className="w-20 h-6 bg-black/20 rounded-lg overflow-hidden">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart data={data}>
            <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
