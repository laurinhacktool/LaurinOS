import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Shield, AlertTriangle, Info, Search, Trash2, Download } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  source: string;
  message: string;
}

export const KernelLogsApp: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/core-api/status');
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data.logs && Array.isArray(data.logs)) {
            // Parse the raw strings into LogEntry objects
            const parsedLogs = data.logs.map((logStr: string, index: number) => {
            // Expected format: "[HH:MM:SS] [SOURCE] Message" or "[HH:MM:SS] Message"
            let timestamp = new Date().toISOString();
            let source = 'KERNEL';
            let message = logStr;
            let level: 'info' | 'warn' | 'error' | 'critical' = 'info';

            const timeMatch = logStr.match(/^\[(\d{2}:\d{2}:\d{2})\]/);
            if (timeMatch) {
              const [hours, minutes, seconds] = timeMatch[1].split(':');
              const d = new Date();
              d.setHours(parseInt(hours, 10), parseInt(minutes, 10), parseInt(seconds, 10));
              timestamp = d.toISOString();
              message = logStr.substring(timeMatch[0].length).trim();
            }

            const sourceMatch = message.match(/^\[(.*?)\]/);
            if (sourceMatch) {
              source = sourceMatch[1];
              message = message.substring(sourceMatch[0].length).trim();
            }

            if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail')) {
              level = 'error';
            } else if (message.toLowerCase().includes('warn')) {
              level = 'warn';
            } else if (message.toLowerCase().includes('critical') || message.toLowerCase().includes('panic')) {
              level = 'critical';
            }

            return {
              id: `log-${index}`,
              timestamp,
              level,
              source,
              message
            };
          });
          setLogs(parsedLogs);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch kernel logs:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let pollTimer: NodeJS.Timeout;

    const pollLogs = async () => {
      if (!isMounted) return;
      await fetchLogs();
      if (isMounted) {
        pollTimer = setTimeout(pollLogs, 2000);
      }
    };

    pollLogs();
    return () => {
      isMounted = false;
      clearTimeout(pollTimer);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter(log => 
    log.message.toLowerCase().includes(filter.toLowerCase()) || 
    log.source.toLowerCase().includes(filter.toLowerCase())
  );

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info': return 'text-blue-400';
      case 'warn': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'critical': return 'text-red-600 font-bold';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/80 text-slate-300 font-mono text-xs">
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-3 border-b border-slate-800 bg-slate-900/50">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-slate-800 border-none rounded px-7 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLogs([])} className="p-1.5 hover:bg-slate-800 rounded transition-colors" title="Clear logs">
            <Trash2 className="w-4 h-4 text-slate-400" />
          </button>
          <button className="p-1.5 hover:bg-slate-800 rounded transition-colors" title="Export logs">
            <Download className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Log List */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-1 custom-scrollbar">
        {filteredLogs.map((log) => (
          <div key={log.id} className="flex gap-3 hover:bg-slate-800/30 p-1 rounded transition-colors group">
            <span className="text-slate-500 shrink-0">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
            <span className={`w-16 shrink-0 font-bold ${getLevelColor(log.level)}`}>{log.level.toUpperCase()}</span>
            <span className="text-blue-500 w-16 shrink-0">[{log.source}]</span>
            <span className="flex-1 break-all">{log.message}</span>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 py-10">
            <Terminal className="w-8 h-8 mb-2 opacity-20" />
            <p>No logs matching filter</p>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-slate-800 bg-slate-900/50 flex justify-between text-[10px] text-slate-500">
        <div className="flex gap-4">
          <span>TOTAL: {logs.length}</span>
          <span>FILTERED: {filteredLogs.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-green-500" />
          <span>KERNEL SECURE</span>
        </div>
      </div>
    </div>
  );
};
