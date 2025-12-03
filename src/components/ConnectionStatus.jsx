import React from 'react';

export default function ConnectionStatus({ status, onRetry }) {
  const statusConfig = {
    connected: {
      label: 'Connected',
      color: 'bg-green-500',
      textColor: 'text-green-700',
      icon: '🟢'
    },
    connecting: {
      label: 'Connecting...',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-700',
      icon: '🟡'
    },
    disconnected: {
      label: 'Disconnected',
      color: 'bg-red-500',
      textColor: 'text-red-700',
      icon: '🔴'
    },
    reconnecting: {
      label: 'Reconnecting...',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-700',
      icon: '🟡'
    }
  };

  const config = statusConfig[status] || statusConfig.disconnected;

  return (
    <div className={`${config.color} text-white px-3 py-1 rounded-full text-xs flex items-center gap-2 mb-2`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {status === 'disconnected' && onRetry && (
        <button
          onClick={onRetry}
          className="ml-2 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs"
        >
          Retry
        </button>
      )}
    </div>
  );
}


