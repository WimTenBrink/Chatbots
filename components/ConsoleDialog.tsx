

import React, { useState } from 'react';
import { Modal } from './Modal';
import { LogEntry, LogLevel } from '../types';
import { CopyIcon, CheckIcon } from './icons';

interface ConsoleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
}

const LOG_LEVEL_CONFIG: Record<LogLevel, { color: string; label: string }> = {
  [LogLevel.INFO]: { color: 'bg-blue-500', label: 'Info' },
  [LogLevel.WARN]: { color: 'bg-yellow-500', label: 'Warning' },
  [LogLevel.ERROR]: { color: 'bg-red-500', label: 'Error' },
  [LogLevel.GEMINI_REQUEST]: { color: 'bg-purple-500', label: 'Gemini Req' },
  [LogLevel.GEMINI_RESPONSE]: { color: 'bg-purple-400', label: 'Gemini Res' },
  [LogLevel.IMAGEN_REQUEST]: { color: 'bg-pink-500', label: 'Imagen Req' },
  [LogLevel.IMAGEN_RESPONSE]: { color: 'bg-pink-400', label: 'Imagen Res' },
};

const LogItem: React.FC<{ log: LogEntry }> = ({ log }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const config = LOG_LEVEL_CONFIG[log.level];

  return (
    <div className="bg-slate-700/50 rounded-lg mb-2 text-sm">
      <div className="flex items-center p-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <span className={`px-2 py-1 text-xs font-semibold text-white ${config.color} rounded-md`}>{config.label}</span>
        <span className="ml-3 font-mono text-xs text-slate-400">{log.timestamp}</span>
        <span className="ml-4 flex-grow text-slate-200 truncate">{log.title}</span>
        <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="ml-4 p-1 text-slate-400 hover:text-white">
          {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
        </button>
      </div>
      {isExpanded && (
        <div className="p-4 border-t border-slate-600">
          <pre className="bg-slate-900 p-3 rounded-md text-slate-300 text-xs whitespace-pre overflow-x-auto">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};


type LogPage = 'All' | LogLevel;

export const ConsoleDialog: React.FC<ConsoleDialogProps> = ({ isOpen, onClose, logs }) => {
  const pages: LogPage[] = ['All', ...Object.values(LogLevel)];
  const [activePage, setActivePage] = useState<LogPage>('All');
  
  const filteredLogs = logs
    .filter(log => activePage === 'All' || log.level === activePage)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Console Log">
      <div className="flex flex-col h-full">
        <nav className="flex-shrink-0 border-b border-slate-700 mb-4">
          <div className="flex space-x-2 overflow-x-auto pb-2 -mb-px">
            {pages.map(page => (
              <button
                key={page}
                onClick={() => setActivePage(page)}
                className={`px-3 py-2 text-sm font-medium rounded-t-md whitespace-nowrap ${
                  activePage === page 
                    ? 'border-b-2 border-sky-400 text-sky-400' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {page === 'All' ? 'All' : LOG_LEVEL_CONFIG[page as LogLevel].label}
              </button>
            ))}
          </div>
        </nav>
        <div className="flex-grow overflow-y-auto pr-2">
            {filteredLogs.length > 0 ? (
                filteredLogs.map(log => <LogItem key={log.id} log={log} />)
            ) : (
                <div className="text-center text-slate-500 py-10">No logs for this category.</div>
            )}
        </div>
      </div>
    </Modal>
  );
};
