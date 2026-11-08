import React from 'react';
import { User } from '../types';
import {
  Shield,
  Lock,
  User as UserIcon,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Zap,
  Layers,
  Database,
} from 'lucide-react';

interface NavbarProps {
  user: User | null;
  dbStatus: 'connected' | 'error' | 'loading';
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  dbStatus,
  onLogout,
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="border-b border-emerald-950/60 bg-[#070a12]/90 backdrop-blur-md sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center space-x-6">
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all duration-300">
              <Shield className="w-5 h-5 text-white transform group-hover:scale-110 transition-transform" />
              <div className="absolute inset-0 rounded-xl bg-emerald-400/20 animate-pulse pointer-events-none" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-black tracking-tight text-white font-mono">
                  TRUE<span className="text-emerald-400">BALANCE</span>
                </span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-mono">
                  v2.0
                </span>
              </div>
              <div className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">
                LedgerLine Financial Core
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          {user && (
            <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-800/80">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center space-x-2 ${
                  activeTab === 'dashboard'
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Vaults & Accounts</span>
              </button>

              <button
                onClick={() => setActiveTab('lab')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center space-x-2 relative ${
                  activeTab === 'lab'
                    ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-950'
                    : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-900/60'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Concurrency Lab</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
              </button>

              {(user.role === 'admin' || user.role === 'auditor') && (
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center space-x-2 ${
                    activeTab === 'audit'
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-950'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Auditor Cockpit</span>
                </button>
              )}
            </nav>
          )}
        </div>

        {/* Right: DB Status & User Profile */}
        <div className="flex items-center space-x-3.5">
          {/* Neon Cloud DB Health Pill */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-mono bg-slate-900/80 border border-slate-800 shadow-inner">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            {dbStatus === 'connected' ? (
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300 font-medium">PostgreSQL 18.6</span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800/50">
                  ACID LOCKED
                </span>
              </div>
            ) : dbStatus === 'loading' ? (
              <span className="text-slate-400">Pinging DB...</span>
            ) : (
              <div className="flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-400 font-semibold">DB Disconnected</span>
              </div>
            )}
          </div>

          {user && (
            <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-200">{user.full_name}</div>
                <div className="flex items-center justify-end space-x-1">
                  <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-emerald-400 font-mono">
                    {user.role}
                  </span>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 shadow">
                <UserIcon className="w-4 h-4 text-emerald-400" />
              </div>

              <button
                onClick={onLogout}
                title="Sign out of LedgerLine"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation bar */}
      {user && (
        <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 bg-slate-950/80 px-4 py-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1 rounded text-xs font-semibold ${
              activeTab === 'dashboard' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            Accounts
          </button>
          <button
            onClick={() => setActiveTab('lab')}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1 ${
              activeTab === 'lab' ? 'text-cyan-400' : 'text-slate-400'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>Concurrency Lab</span>
          </button>
          {(user.role === 'admin' || user.role === 'auditor') && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                activeTab === 'audit' ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              Auditor
            </button>
          )}
        </div>
      )}
    </header>
  );
};
