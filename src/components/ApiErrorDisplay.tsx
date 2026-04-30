import React from 'react';
import { ApiError } from '../types';
import { AlertCircle, RotateCcw, ShieldAlert, WifiOff, ExternalLink } from 'lucide-react';

interface ApiErrorDisplayProps {
  error: ApiError;
  onRetry?: () => void;
  onSwitchOffline?: () => void;
  className?: string;
}

const ApiErrorDisplay: React.FC<ApiErrorDisplayProps> = ({ error, onRetry, onSwitchOffline, className = "" }) => {
  const getIcon = () => {
    switch (error.type) {
      case 'RATE_LIMIT': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'AUTH_ERROR': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'SAFETY_BLOCK': return <ShieldAlert className="w-5 h-5 text-purple-500" />;
      case 'NETWORK_ERROR': return <WifiOff className="w-5 h-5 text-blue-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTitle = () => {
    switch (error.type) {
      case 'RATE_LIMIT': return "Limit dopytov (429)";
      case 'AUTH_ERROR': return "Chyba autentifikácie";
      case 'SAFETY_BLOCK': return "Bezpečnostný filter";
      case 'NETWORK_ERROR': return "Chyba siete";
      default: return "Chyba systému";
    }
  };

  return (
    <div className={`p-4 rounded-lg bg-white/5 border border-white/10 flex flex-col gap-3 max-w-sm ${className}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1">
          <h4 className="text-sm font-bold opacity-90 mb-1">{getTitle()}</h4>
          <p className="text-xs opacity-70 leading-relaxed">{error.message}</p>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-1">
        {onRetry && (
          <button 
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-[10px] font-bold transition-colors uppercase tracking-widest"
          >
            <RotateCcw className="w-3 h-3" /> Skúsiť znova
          </button>
        )}

        {onSwitchOffline && (error.type === 'RATE_LIMIT' || error.type === 'NETWORK_ERROR' || error.type === 'AUTH_ERROR') && (
          <button 
            onClick={onSwitchOffline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] font-bold transition-colors uppercase tracking-widest border border-amber-500/20"
          >
            <WifiOff className="w-3 h-3" /> Offline Režim
          </button>
        )}
        
        {error.type === 'RATE_LIMIT' && (
          <a 
            href="https://aistudio.google.com/app/plan_and_billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-[10px] font-bold transition-colors uppercase tracking-widest"
          >
            <ExternalLink className="w-3 h-3" /> Zmeniť plán
          </a>
        )}
      </div>
    </div>
  );
};

export default ApiErrorDisplay;
