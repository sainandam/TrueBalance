import React, { useState } from 'react';
import { api } from '../services/api';
import { PlusCircle, AlertCircle } from 'lucide-react';

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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Open New Account</h3>
              <p className="text-xs text-slate-400">Initialize a double-entry ledger account</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Account Name / Purpose</label>
            <input
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Primary Savings, Operations Fund"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="INR">INR (Indian Rupee - ₹)</option>
            </select>
          </div>

          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Overdraft Limit (₹ INR) [Admin Only]</label>
              <input
                type="number"
                min="0"
                step="1"
                value={overdraftRupees}
                onChange={(e) => setOverdraftRupees(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
