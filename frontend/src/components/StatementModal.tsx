import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Account, AccountStatement, LedgerVerificationReport } from '../types';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Hash,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface StatementModalProps {
  account: Account;
  onClose: () => void;
}

export const StatementModal: React.FC<StatementModalProps> = ({ account, onClose }) => {
  const [statement, setStatement] = useState<AccountStatement | null>(null);
  const [verifyReport, setVerifyReport] = useState<LedgerVerificationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'postings' | 'refusals'>('all');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStatement(account.id);
      setStatement(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statement');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const report = await api.verifyLedger(account.id);
      setVerifyReport(report);
    } catch (err) {
      alert('Verification failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [account.id]);

  // Combine entries and refusals into a chronological list
  const combinedItems = React.useMemo(() => {
    if (!statement) return [];
    const entries = statement.entries.map((e) => ({
      ...e,
      itemType: 'entry' as const,
    }));
    const refusals = statement.refusal_attempts.map((r) => ({
      ...r,
      itemType: 'refusal' as const,
    }));
    return [...entries, ...refusals].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [statement]);

  const filteredItems = combinedItems.filter((item) => {
    if (filter === 'postings') return item.itemType === 'entry';
    if (filter === 'refusals') return item.itemType === 'refusal';
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white">{account.account_name}</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {account.account_number}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auditable Account Statement with Cryptographic Provenance
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900/50 transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{verifying ? 'Verifying Chain...' : 'Verify Cryptographic Integrity'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Verification Report Banner */}
        {verifyReport && (
          <div className={`p-4 border-b ${
            verifyReport.is_valid
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {verifyReport.is_valid ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <span className="text-xs font-bold uppercase tracking-wider">
                  {verifyReport.is_valid
                    ? 'CRYPTOGRAPHIC CHAIN VALIDATED: 100% UNBROKEN & UNTAMPERED'
                    : 'INTEGRITY ALERT: TAMPERING OR DRIFT DETECTED'}
                </span>
              </div>
              <div className="text-xs font-mono">
                Global Sum: {verifyReport.global_sum_paise} paise ({verifyReport.global_sum_is_zero ? 'Zero-Sum Conserved' : 'Violated'})
              </div>
            </div>
          </div>
        )}

        {/* Balance & Stats Header */}
        <div className="p-6 bg-slate-950/50 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-[11px] uppercase font-semibold text-slate-400">Current Balance</div>
            <div className="text-2xl font-bold text-white mt-0.5">
              ₹{(account.balance_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">{account.balance_paise.toLocaleString()} paise</div>
          </div>

          <div>
            <div className="text-[11px] uppercase font-semibold text-slate-400">Total Postings</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">
              {statement?.total_entries ?? 0}
            </div>
            <div className="text-[10px] text-slate-500">Atomic ledger records</div>
          </div>

          <div>
            <div className="text-[11px] uppercase font-semibold text-slate-400">Durable Refusals</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">
              {statement?.total_refusals ?? 0}
            </div>
            <div className="text-[10px] text-slate-500">Recorded refusal attempts</div>
          </div>

          <div>
            <div className="text-[11px] uppercase font-semibold text-slate-400">Tip Hash Pointer</div>
            <div className="text-xs font-mono text-slate-300 truncate mt-1" title={account.last_entry_hash || 'None'}>
              {account.last_entry_hash ? account.last_entry_hash.slice(0, 16) + '...' : 'Genesis (None)'}
            </div>
            <div className="text-[10px] text-slate-500">SHA-256 Ledger Tip</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 py-2 border-b border-slate-800 flex items-center justify-between text-xs bg-slate-900">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Activities ({combinedItems.length})
            </button>
            <button
              onClick={() => setFilter('postings')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filter === 'postings' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Settled Postings ({statement?.total_entries ?? 0})
            </button>
            <button
              onClick={() => setFilter('refusals')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filter === 'refusals' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Durable Refusals ({statement?.total_refusals ?? 0})
            </button>
          </div>
        </div>

        {/* Statement Scrollable List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading statement records...</div>
          ) : error ? (
            <div className="text-center py-12 text-rose-400 text-sm">{error}</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No transaction records found for this account.</div>
          ) : (
            filteredItems.map((item) => {
              if (item.itemType === 'entry') {
                const isCredit = item.amount_paise > 0;
                return (
                  <div
                    key={`entry-${item.id}`}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isCredit ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold uppercase text-white tracking-wide">
                              {item.transaction_type}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                              Entry #{item.entry_number}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {item.reason || 'Double-entry transfer'}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(item.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-sm font-bold font-mono ${
                          isCredit ? 'text-emerald-400' : 'text-slate-100'
                        }`}>
                          {isCredit ? '+' : ''}₹{(item.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Bal: ₹{(item.running_balance_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Hash Provenance Bar */}
                    <div className="mt-3 pt-2.5 border-t border-slate-900 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
                      <div className="truncate" title={item.entry_hash}>
                        <span className="text-slate-400 font-semibold">Entry Hash: </span>
                        <span className="text-emerald-400/90">{item.entry_hash.slice(0, 24)}...</span>
                      </div>
                      <div className="truncate" title={item.prev_hash || 'Genesis'}>
                        <span className="text-slate-400 font-semibold">Prev Hash: </span>
                        <span>{item.prev_hash ? `${item.prev_hash.slice(0, 24)}...` : 'Genesis (None)'}</span>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Refusal Record
                return (
                  <div
                    key={`refusal-${item.id}`}
                    className="p-4 bg-amber-950/20 border border-amber-900/50 rounded-xl"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-950 text-amber-400 border border-amber-800 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold uppercase text-amber-300 tracking-wide">
                              Refused {item.request_type}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 uppercase">
                              {item.reason_code || 'REFUSED'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Transaction safely rejected by ACID concurrency guard. No balance altered.
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(item.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-amber-400/80 line-through">
                          ₹{(item.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                          Refusal Durable Record
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            })
          )}
        </div>
      </div>
    </div>
  );
};
