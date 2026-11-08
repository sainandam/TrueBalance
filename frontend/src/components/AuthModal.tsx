import React, { useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { Shield, Lock, ArrowRight, UserCheck, KeyRound } from 'lucide-react';

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
      setError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">LedgerLine TrueBalance</h2>
          <p className="text-sm text-slate-400 mt-1">
            Enterprise Financial Transaction Engine & Immutable Double-Entry Ledger
          </p>
        </div>

        {/* 1-Click Quick Demo Sign-in */}
        <div className="mb-6 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>Instant Demo Sign-in (Seed Accounts)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => quickLogin('holder@ledgerline.io', 'Holder@12345!')}
              disabled={loading}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 border border-slate-700 transition"
            >
              Account Holder
            </button>
            <button
              type="button"
              onClick={() => quickLogin('auditor@ledgerline.io', 'Auditor@12345!')}
              disabled={loading}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-teal-300 border border-slate-700 transition"
            >
              Auditor
            </button>
            <button
              type="button"
              onClick={() => quickLogin('admin@ledgerline.io', 'Admin@12345!')}
              disabled={loading}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-indigo-300 border border-slate-700 transition"
            >
              Admin
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500 font-semibold">Or with credentials</span></div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800/50 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Saikiran Nandam"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="holder">Account Holder (Customer)</option>
                <option value="auditor">Auditor (Inspect & Verify Ledger)</option>
                <option value="admin">Administrator (System Control)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-sm font-semibold rounded-lg shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
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
