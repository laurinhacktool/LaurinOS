import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

interface CoinDetailProps {
  name: string;
  symbol: string;
  balance: number;
  priceEur: number;
  data: { value: number }[];
  onClick?: () => void;
}

export const CoinDetail: React.FC<CoinDetailProps> = ({ name, symbol, balance, priceEur, data, onClick }) => {
  const totalValue = balance * priceEur;
  
  return (
    <div 
      className={`bg-glass-1a1a1a rounded-lg p-4 flex flex-col gap-2 ${onClick ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {name === 'LauCoin' && (
            <img src="/alfacoin.png" alt="LauCoin" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
          )}
          <div>
            <h3 className="text-blue-500 font-bold">{name}</h3>
            <p className="text-gray-500 text-xs">{symbol}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white font-mono">{balance.toFixed(4)}</p>
          <p className="text-emerald-500 text-xs font-mono">{(totalValue).toFixed(2)} EUR</p>
        </div>
      </div>
      <div className="h-16 w-full mt-2 relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(17, 17, 17, 0.8)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255, 255, 255, 0.1)', fontSize: '12px' }}
              itemStyle={{ color: '#fff' }}
              labelStyle={{ display: 'none' }}
            />
            <YAxis domain={['auto', 'auto']} hide />
          </LineChart>
        </ResponsiveContainer>
        <div className="absolute bottom-0 right-0 bg-glass-111 px-1 rounded text-[10px] text-gray-400 font-mono">
          Value: {data[data.length - 1].value.toFixed(2)} €
        </div>
      </div>
    </div>
  );
};
