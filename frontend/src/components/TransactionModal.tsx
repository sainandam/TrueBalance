import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Account } from '../types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Key,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react';

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
    sourceAccount ? sourceAccount.id : accounts[0]?.id || ''
  );
  const [amountRupees, setAmountRupees] = useState('');
  const [reason, setReason] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Auto-generate fresh unique idempotency key
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, [type]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(idempotencyKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1500);
  };

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
        setSuccessMsg(`Deposit of ₹${parsedRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })} successfully settled!`);
      } else if (type === 'withdraw') {
        const accId = fromAccountId;
        if (!accId) throw new Error('Please select an account for withdrawal.');
        await api.withdraw(accId, amountPaise, reason || 'Customer Withdrawal', idempotencyKey);
        setSuccessMsg(`Withdrawal of ₹${parsedRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })} successfully settled!`);
      } else if (type === 'transfer') {
        if (!fromAccountId || !targetAccountId) {
          throw new Error('Please select both source and destination accounts.');
        }
        if (fromAccountId === targetAccountId) {
          throw new Error('Source and destination accounts cannot be the same.');
        }
        await api.transfer(fromAccountId, targetAccountId, amountPaise, reason || 'Account Transfer', idempotencyKey);
        setSuccessMsg(`Transfer of ₹${parsedRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })} successfully balanced!`);
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

  const selectedFromAccount = accounts.find((a) => a.id === fromAccountId);
  const selectedTargetAccount = accounts.find((a) => a.id === targetAccountId);

  return (
    <div className="fixed inset-0 bg-[#03060c]/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#090d16] border border-emerald-950/80 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Top Glow Accent Bar */}
        <div
          className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${
            type === 'deposit'
              ? 'from-emerald-500 via-teal-400 to-emerald-500'
              : type === 'withdraw'
              ? 'from-amber-500 via-orange-400 to-amber-500'
              : 'from-cyan-500 via-blue-400 to-cyan-500'
          }`}
        />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${
                type === 'deposit'
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 shadow-emerald-950/50'
                  : type === 'withdraw'
                  ? 'bg-amber-950/80 text-amber-400 border border-amber-700/60 shadow-amber-950/50'
                  : 'bg-cyan-950/80 text-cyan-400 border border-cyan-700/60 shadow-cyan-950/50'
              }`}
            >
              {type === 'deposit' && <ArrowDownLeft className="w-5 h-5" />}
              {type === 'withdraw' && <ArrowUpRight className="w-5 h-5" />}
              {type === 'transfer' && <ArrowLeftRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white capitalize tracking-tight font-sans">
                {type === 'deposit' ? 'Direct Deposit' : type === 'withdraw' ? 'Account Withdrawal' : 'Atomic Vault Transfer'}
              </h3>
              <p className="text-xs text-slate-400 font-mono">Zero-Sum Conserved Ledger Engine</p>
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
          <div className="mb-4 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Transaction Refused: </span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transfer Source Account Selection */}
          {(type === 'withdraw' || type === 'transfer') && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">
                From Account (Debit)
              </label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#05080f] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} ({acc.account_number}) — Bal: ₹{(acc.balance_paise / 100).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Transfer Target Account Selection */}
          {(type === 'deposit' || type === 'transfer') && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">
                {type === 'deposit' ? 'Destination Account (Credit)' : 'To Account (Credit)'}
              </label>
              <select
                value={type === 'deposit' && sourceAccount ? sourceAccount.id : targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                disabled={type === 'deposit' && !!sourceAccount}
                className="w-full px-3.5 py-2.5 bg-[#05080f] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60 font-mono"
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

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">
              Amount (₹ INR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-base text-slate-400 font-bold font-mono">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="100.00"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#05080f] border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            {amountRupees && !isNaN(parseFloat(amountRupees)) && (
              <div className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between font-mono">
                <span>Exact Integer Conversion:</span>
                <span className="text-emerald-400 font-bold">
                  {Math.round(parseFloat(amountRupees) * 100).toLocaleString()} paise
                </span>
              </div>
            )}
          </div>

          {/* Purpose / Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase font-mono">
              Transaction Memo / Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Monthly cloud server fee, Invoice settlement"
              className="w-full px-3.5 py-2 bg-[#05080f] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Idempotency Key Section */}
          <div className="bg-[#05080f] p-3.5 rounded-xl border border-slate-800/90">
            <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
              <span className="font-bold text-slate-300 flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Idempotency-Key (Replay Protection)</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIdempotencyKey(crypto.randomUUID())}
                  className="text-[10px] text-emerald-400 hover:underline"
                >
                  Regenerate
                </button>
              </div>
            </div>
            <input
              type="text"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#090d16] border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Guarantees zero double-execution even under chaotic network packet duplication.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3">
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
              className={`px-5 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider text-white shadow-lg transition-all disabled:opacity-50 ${
                type === 'deposit'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-500/20'
                  : type === 'withdraw'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 shadow-amber-500/20'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 shadow-cyan-500/20'
              }`}
            >
              {loading ? 'Executing Atomic Ledger Write...' : `Execute ${type}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
