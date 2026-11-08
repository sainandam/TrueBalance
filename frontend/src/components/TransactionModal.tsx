import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Account } from '../types';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Key, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TransactionModalProps {
  type: 'deposit' | 'withdraw' | 'transfer';
  sourceAccount?: Account;
  accounts: Account[];
  onClose: () => void;
  onSuccess: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  type,
  sourceAccount,
  accounts,
  onClose,
  onSuccess,
}) => {
  const [targetAccountId, setTargetAccountId] = useState(
    type === 'deposit' && sourceAccount ? sourceAccount.id : ''
  );
  const [fromAccountId, setFromAccountId] = useState(
    sourceAccount ? sourceAccount.id : (accounts[0]?.id || '')
  );
  const [amountRupees, setAmountRupees] = useState('');
  const [reason, setReason] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-generate fresh unique idempotency key
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const parsedRupees = parseFloat(amountRupees);
    if (isNaN(parsedRupees) || parsedRupees <= 0) {
      setError('Please enter a valid amount greater than ₹0.');
      return;
    }

    const amountPaise = Math.round(parsedRupees * 100);
    setLoading(true);

    try {
      if (type === 'deposit') {
        const accId = sourceAccount?.id || targetAccountId;
        if (!accId) throw new Error('Please select an account for deposit.');
        await api.deposit(accId, amountPaise, reason || 'Customer Deposit', idempotencyKey);
        setSuccessMsg(`Deposit of ₹${parsedRupees.toLocaleString()} successful!`);
      } else if (type === 'withdraw') {
        const accId = fromAccountId;
        if (!accId) throw new Error('Please select an account for withdrawal.');
        await api.withdraw(accId, amountPaise, reason || 'Customer Withdrawal', idempotencyKey);
        setSuccessMsg(`Withdrawal of ₹${parsedRupees.toLocaleString()} successful!`);
      } else if (type === 'transfer') {
        if (!fromAccountId || !targetAccountId) {
          throw new Error('Please select both source and destination accounts.');
        }
        if (fromAccountId === targetAccountId) {
          throw new Error('Source and destination accounts cannot be the same.');
        }
        await api.transfer(fromAccountId, targetAccountId, amountPaise, reason || 'Account Transfer', idempotencyKey);
        setSuccessMsg(`Transfer of ₹${parsedRupees.toLocaleString()} successful!`);
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              type === 'deposit' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
              type === 'withdraw' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
              'bg-blue-950 text-blue-400 border border-blue-800'
            }`}>
              {type === 'deposit' && <ArrowDownLeft className="w-5 h-5" />}
              {type === 'withdraw' && <ArrowUpRight className="w-5 h-5" />}
              {type === 'transfer' && <ArrowLeftRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white capitalize">{type} Funds</h3>
              <p className="text-xs text-slate-400">Atomic double-entry transaction</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'transfer' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">From Account (Source)</label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} ({acc.account_number}) — ₹{(acc.balance_paise / 100).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(type === 'deposit' || type === 'transfer') && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {type === 'deposit' ? 'Target Account' : 'To Account (Destination)'}
              </label>
              <select
                value={type === 'deposit' && sourceAccount ? sourceAccount.id : targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                disabled={type === 'deposit' && !!sourceAccount}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60"
              >
                <option value="">Select destination account...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} ({acc.account_number})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Amount (₹ INR)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-slate-400 font-semibold">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="100.00"
                className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            {amountRupees && !isNaN(parseFloat(amountRupees)) && (
              <div className="text-[11px] text-slate-400 mt-1">
                Paise equivalent: <span className="font-mono text-emerald-400">{Math.round(parseFloat(amountRupees) * 100).toLocaleString()} paise</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description / Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Monthly rent, Vendor payment"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Idempotency Key Section */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Idempotency-Key (Replay Protection)</span>
              </span>
              <button
                type="button"
                onClick={() => setIdempotencyKey(crypto.randomUUID())}
                className="text-[10px] text-emerald-400 hover:underline font-mono"
              >
                Regenerate
              </button>
            </div>
            <input
              type="text"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-slate-300 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Ensures multiple network submissions never execute duplicate money movements.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
            >
              {loading ? 'Processing Transaction...' : `Confirm ${type}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
