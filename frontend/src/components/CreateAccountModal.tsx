import React, { useState } from 'react';
import { api } from '../services/api';
import { PlusCircle, AlertCircle, ShieldCheck } from 'lucide-react';

interface CreateAccountModalProps {
  onClose: () => void;
  onSuccess: () => void;
  isAdmin?: boolean;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  onClose,
  onSuccess,
  isAdmin,
}) => {
  const [accountName, setAccountName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [overdraftRupees, setOverdraftRupees] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const overdraftPaise = isAdmin ? Math.round(parseFloat(overdraftRupees || '0') * 100) : 0;
      await api.createAccount(accountName, currency, overdraftPaise);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#03060c]/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#090d16] border border-emerald-950/80 w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Top Glow Edge */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Open New Vault Account</h3>
              <p className="text-xs text-slate-400 font-mono">ACID-Enforced Ledger Node</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">
              Account Name / Designation
            </label>
            <input
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Primary Savings Vault, Operations Fund"
              className="w-full px-3.5 py-2.5 bg-[#05080f] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">
              Currency Standard
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#05080f] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            >
              <option value="INR">INR (Indian Rupee - ₹) [64-bit integer paise]</option>
            </select>
          </div>

          {isAdmin && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">
                Overdraft Limit (₹ INR) <span className="text-indigo-400">[Admin Superuser]</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={overdraftRupees}
                onChange={(e) => setOverdraftRupees(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 bg-[#05080f] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Allows balance to dip below ₹0 strictly up to this limit without throwing INSUFFICIENT_FUNDS.
              </p>
            </div>
          )}

          <div className="bg-[#05080f] p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Automatic Genesis Hash tip and row locks will be created.</span>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all"
            >
              {loading ? 'Initializing Ledger...' : 'Create Vault Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
