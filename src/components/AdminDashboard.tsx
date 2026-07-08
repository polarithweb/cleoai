import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  MessageSquare, 
  Clock, 
  RotateCcw, 
  RefreshCw, 
  ArrowLeft, 
  Activity, 
  BarChart3,
  Cpu,
  AlertTriangle
} from 'lucide-react';
import { getStatsFirebase, resetStatsFirebase } from '../utils/firebase';

interface Stats {
  totalMessages: number;
  totalUsers: number;
  messagesByModel: Record<string, number>;
  recentActivity: Array<{ timestamp: string; event: string }>;
}

interface AdminDashboardProps {
  onBack: () => void;
}

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [dataSource, setDataSource] = useState<'Firebase' | 'Server API' | null>(null);

  const fetchStats = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // 1. Try Firebase first
      try {
        const fbStats = await getStatsFirebase();
        setStats(fbStats);
        setDataSource('Firebase');
      } catch (fbErr) {
        console.warn('Firebase stats failed, falling back to local server endpoint:', fbErr);
        
        // 2. Fallback to Express backend endpoint
        const response = await fetch('/api/stats');
        if (!response.ok) {
          throw new Error(`Server returned error status ${response.status}`);
        }
        const data = await response.json();
        setStats(data);
        setDataSource('Server API');
      }
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err?.message || 'Failed to fetch admin stats');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      // Try resetting Firebase stats first
      try {
        const newFbStats = await resetStatsFirebase();
        setStats(newFbStats);
        setDataSource('Firebase');
        setShowResetConfirm(false);
      } catch (fbErr) {
        console.warn('Firebase reset failed, trying fallback to local server:', fbErr);
        
        // Fallback to Express reset endpoint
        const response = await fetch('/api/stats/reset', {
          method: 'POST',
        });
        if (!response.ok) {
          throw new Error(`Failed to reset stats`);
        }
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
          setDataSource('Server API');
          setShowResetConfirm(false);
        }
      }
    } catch (err: any) {
      console.error('Error resetting stats:', err);
      alert(err?.message || 'Failed to reset stats');
    } finally {
      setIsResetting(false);
    }
  };

  const getModelName = (id: string) => {
    const names: Record<string, string> = {
      kodama: 'Polarith Kodama (400B)',
      amabie: 'Polarith Amabie 1.0 (160B)',
      kaze: 'Polarith Kaze 1.0 (8B)'
    };
    return names[id] || id;
  };

  const getModelColor = (id: string) => {
    const colors: Record<string, string> = {
      kodama: 'bg-blue-500',
      amabie: 'bg-purple-500',
      kaze: 'bg-amber-500'
    };
    return colors[id] || 'bg-slate-400';
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return isoString;
    }
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins === 1) return '1 min ago';
      if (diffMins < 60) return `${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours === 1) return '1 hour ago';
      if (diffHours < 24) return `${diffHours} hours ago`;
      return d.toLocaleDateString();
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#f0f3f8] overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col items-center" id="polarith-admin-root">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        
        {/* Navigation & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4" id="admin-header-row">
          <div className="flex items-center gap-3">
            <button
              id="admin-btn-back"
              onClick={onBack}
              className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600 flex items-center justify-center cursor-pointer"
              title="Return to Chat"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight" id="admin-title">
                  Polarith Analytics
                </h1>
                {dataSource && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    dataSource === 'Firebase' 
                      ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {dataSource}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500" id="admin-subtitle">
                Secure real-time system metrics and engagement console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="admin-btn-refresh"
              onClick={() => fetchStats(true)}
              disabled={isLoading || isRefreshing}
              className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-all text-sm font-medium text-slate-700 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-blue-500' : 'text-slate-500'} />
              Refresh
            </button>
            <button
              id="admin-btn-reset-trigger"
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 text-red-600 hover:text-red-700 transition-all text-sm font-medium flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw size={16} />
              Reset Stats
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3" id="admin-loading-state">
            <RefreshCw size={36} className="animate-spin text-blue-500" />
            <p className="text-sm font-medium text-slate-500">Retrieving system stats...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex flex-col items-center gap-3 text-center my-10" id="admin-error-state">
            <AlertTriangle className="text-red-500" size={32} />
            <p className="text-sm font-semibold text-red-800">Connection Error</p>
            <p className="text-xs text-red-600 max-w-md">{error}</p>
            <button
              id="admin-btn-retry"
              onClick={() => fetchStats()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-xl shadow-sm transition-colors cursor-pointer mt-2"
            >
              Retry Connection
            </button>
          </div>
        ) : stats ? (
          <div className="flex flex-col gap-6" id="admin-dashboard-layout">
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="admin-metrics-grid">
              
              {/* Stat 1: Total Users */}
              <motion.div
                id="admin-card-users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4"
              >
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Users</p>
                  <h3 className="text-2xl font-bold text-slate-800 leading-none mt-1">
                    {stats.totalUsers.toLocaleString()}
                  </h3>
                  <p className="text-xxs text-slate-500 mt-1">Unique client sessions</p>
                </div>
              </motion.div>

              {/* Stat 2: Total Messages */}
              <motion.div
                id="admin-card-messages"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4"
              >
                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Messages Sent</p>
                  <h3 className="text-2xl font-bold text-slate-800 leading-none mt-1">
                    {stats.totalMessages.toLocaleString()}
                  </h3>
                  <p className="text-xxs text-slate-500 mt-1">Processed requests</p>
                </div>
              </motion.div>

              {/* Stat 3: Avg Messages per User */}
              <motion.div
                id="admin-card-ratio"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4"
              >
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Activity size={24} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Messages</p>
                  <h3 className="text-2xl font-bold text-slate-800 leading-none mt-1">
                    {stats.totalUsers > 0 ? (stats.totalMessages / stats.totalUsers).toFixed(1) : '0.0'}
                  </h3>
                  <p className="text-xxs text-slate-500 mt-1">Messages per session</p>
                </div>
              </motion.div>

            </div>

            {/* Charts & Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" id="admin-detail-grid">
              
              {/* Model Popularity Chart */}
              <motion.div
                id="admin-panel-models"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <BarChart3 className="text-blue-500" size={18} />
                  <h4 className="text-sm font-bold text-slate-700">Model Popularity</h4>
                </div>

                <div className="flex flex-col gap-4 py-2">
                  {Object.entries(stats.messagesByModel || {}).map(([modelId, count]) => {
                    const countNum = Number(count);
                    const percentage = stats.totalMessages > 0 
                      ? Math.round((countNum / stats.totalMessages) * 100) 
                      : 0;

                    return (
                      <div key={modelId} className="flex flex-col gap-1.5" id={`model-stat-${modelId}`}>
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-600 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${getModelColor(modelId)}`}></span>
                            {getModelName(modelId)}
                          </span>
                          <span className="text-slate-500">
                            {count.toLocaleString()} ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full ${getModelColor(modelId)} rounded-full`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}

                  {Object.keys(stats.messagesByModel || {}).length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No model interactions tracked yet.
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Recent Activity Log */}
              <motion.div
                id="admin-panel-activity"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Clock className="text-purple-500" size={18} />
                  <h4 className="text-sm font-bold text-slate-700">Live Activity Feed</h4>
                </div>

                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1" id="admin-activity-list">
                  {stats.recentActivity && stats.recentActivity.length > 0 ? (
                    stats.recentActivity.map((activity, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-start justify-between gap-4 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-100 transition-colors"
                        id={`activity-item-${idx}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 mt-0.5">
                            <Cpu size={14} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-700 font-medium">{activity.event}</p>
                            <p className="text-xxs text-slate-400 mt-0.5">{formatTime(activity.timestamp)} UTC</p>
                          </div>
                        </div>
                        <span className="text-xxs font-semibold bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md shrink-0">
                          {getRelativeTime(activity.timestamp)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center gap-2">
                      <Clock size={24} className="text-slate-300" />
                      No recent actions logged.
                    </div>
                  )}
                </div>
              </motion.div>

            </div>

          </div>
        ) : null}

      </div>

      {/* Confirmation Dialog Box for Resetting Stats */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="admin-reset-modal">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 max-w-sm w-full flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <h3 className="font-bold text-slate-800">Confirm Reset</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you absolutely sure you want to clear all analytics data? This will permanently wipe unique user counts, total messages, and popular model breakdowns.
            </p>

            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                id="admin-btn-reset-cancel"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-50 border border-slate-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="admin-btn-reset-confirm"
                onClick={handleReset}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isResetting ? <RefreshCw className="animate-spin" size={12} /> : null}
                Reset Analytics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
