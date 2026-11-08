import React from 'react';
import { User } from '../types';
import { Shield, Lock, User as UserIcon, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

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
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">TrueBalance</span>
              <span className="text-xs font-semibold text-emerald-400 ml-2 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                LEDGERLINE
              </span>
            </div>
          </div>

          {user && (
            <nav className="hidden md:flex space-x-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'dashboard'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                Accounts & Operations
              </button>

              {(user.role === 'admin' || user.role === 'auditor') && (
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center space-x-1.5 ${
                    activeTab === 'audit'
                      ? 'bg-slate-800 text-emerald-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Auditor Cockpit</span>
                </button>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {/* DB Health Pill */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 border border-slate-700">
            {dbStatus === 'connected' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-slate-300">Neon PostgreSQL Direct</span>
              </>
            ) : dbStatus === 'loading' ? (
              <span className="text-slate-400">Connecting...</span>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-400">Database Offline</span>
              </>
            )}
          </div>

          {user && (
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-white">{user.full_name}</div>
                <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  {user.role}
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <UserIcon className="w-4 h-4" />
              </div>

              <button
                onClick={onLogout}
                title="Sign out"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
