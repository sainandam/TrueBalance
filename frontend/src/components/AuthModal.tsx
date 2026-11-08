import React, { useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import {
  Shield,
  Lock,
  ArrowRight,
  UserCheck,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'holder' | 'auditor' | 'admin'>('holder');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await api.register(email, fullName, password, role);
        const loginRes = await api.login(email, password);
        onSuccess(loginRes.user);
      } else {
        const loginRes = await api.login(email, password);
        onSuccess(loginRes.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string, demoPass: string) => {
    setError(null);
    setLoading(true);
    try {
      const loginRes = await api.login(demoEmail, demoPass);
      onSuccess(loginRes.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg bg-[#080c16] border border-emerald-950/80 rounded-3xl p-8 sm:p-9 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-7">
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-600 flex items-center justify-center mx-auto mb-3.5 shadow-xl shadow-emerald-500/25">
            <Shield className="w-7 h-7 text-white" />
            <div className="absolute inset-0 rounded-2xl bg-emerald-400/20 animate-pulse pointer-events-none" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
            TRUE<span className="text-emerald-400">BALANCE</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Double-Entry Financial Accounting Core &amp; ACID Row-Locked Transaction Engine
          </p>
        </div>

        {/* 1-Click Quick Demo Sign-in for Judges */}
        <div className="mb-6 bg-[#050810] p-4 rounded-2xl border border-slate-800/90 shadow-inner">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-between font-mono">
            <span className="flex items-center space-x-1.5 text-emerald-400">
              <Zap className="w-3.5 h-3.5" />
              <span>Judge Quick-Access (Pre-Seeded)</span>
            </span>
            <span className="text-[9px] text-slate-500 font-sans">Click to sign in instantly</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => quickLogin('holder@ledgerline.io', 'Holder@12345!')}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-emerald-950/60 border border-slate-800 hover:border-emerald-500/50 text-left transition group"
            >
              <div className="text-xs font-bold text-emerald-300 group-hover:text-emerald-200">
                Holder
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                Customer View
              </div>
            </button>

            <button
              type="button"
              onClick={() => quickLogin('auditor@ledgerline.io', 'Auditor@12345!')}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/50 text-left transition group"
            >
              <div className="text-xs font-bold text-cyan-300 group-hover:text-cyan-200">
                Auditor
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                Verify Invariants
              </div>
            </button>

            <button
              type="button"
              onClick={() => quickLogin('admin@ledgerline.io', 'Admin@12345!')}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/50 text-left transition group"
            >
              <div className="text-xs font-bold text-indigo-300 group-hover:text-indigo-200">
                Admin
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                System Superuser
              </div>
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest">
            <span className="bg-[#080c16] px-3 text-slate-500">Or Manual Authentication</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegister && (
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Saikiran Nandam"
                className="w-full px-3.5 py-2.5 bg-[#05080f] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3.5 py-2.5 bg-[#05080f] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 bg-[#05080f] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1">Security Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-[#05080f] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition font-mono"
              >
                <option value="holder">Account Holder (Customer)</option>
                <option value="auditor">Auditor (Ledger Verification)</option>
                <option value="admin">Administrator (Superuser Access)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold uppercase font-mono tracking-wider rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : isRegister ? 'Create Vault Account' : 'Sign In to TrueBalance'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          {isRegister ? 'Already registered?' : 'Need a new account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-emerald-400 font-semibold hover:underline ml-1"
          >
            {isRegister ? 'Sign In' : 'Register now'}
          </button>
        </div>
      </div>
    </div>
  );
};
