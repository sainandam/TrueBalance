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
  Copy,
  Check,
  Link as LinkIcon,
  Filter,
  Lock,
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
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

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

  const copyToClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1800);
  };

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
    <div className="fixed inset-0 bg-[#03060c]/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#090d16] border border-emerald-950/70 w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        {/* Top Glow Edge */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/80 to-transparent" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#060910]">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-950/70 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-950/40">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white tracking-tight">{account.account_name}</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700/80">
                  {account.account_number}
                </span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                  account.status === 'active'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                    : 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                }`}>
                  {account.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center space-x-1.5">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>SHA-256 Merkle Provenance Ledger with Kernel-Enforced Immutability</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end sm:self-auto">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-900/40 hover:border-emerald-400 transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
            >
              <ShieldCheck className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Recalculating SHA-256...' : 'Audit Hash Chain'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Verification Result Banner */}
        {verifyReport && (
          <div className={`p-4 border-b transition-all ${
            verifyReport.is_valid
              ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/70 text-rose-300'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                {verifyReport.is_valid ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wide">
                    {verifyReport.is_valid
                      ? 'CRYPTOGRAPHIC CHAIN VALIDATED: 100% UNBROKEN & MATHEMATICALLY CONSERVED'
                      : 'TAMPER ALERT: COMPROMISED LEDGER ENTRY OR BROKEN HASH CHAIN'}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Checked {verifyReport.total_entries} ledger entries against kernel SHA-256 hashes.
                  </p>
                </div>
              </div>
              <div className="text-xs font-mono bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
                &sum; Invariant: <span className="text-emerald-400 font-bold">{verifyReport.global_sum_paise} paise</span> (Conserved: {verifyReport.global_sum_is_zero ? 'YES' : 'NO'})
              </div>
            </div>
          </div>
        )}

        {/* Account Core Stats Bar */}
        <div className="p-5 bg-[#05080f] border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Settled Balance</div>
            <div className="text-2xl font-black text-white mt-0.5 tracking-tight">
              ₹{(account.balance_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-emerald-400/90 font-mono mt-0.5">
              {account.balance_paise.toLocaleString()} paise (64-bit int)
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Ledger Postings</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-0.5 font-mono">
              {statement?.total_entries ?? 0}
            </div>
            <div className="text-[10px] text-slate-500">Atomic journal records</div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Durable Refusals</div>
            <div className="text-xl font-extrabold text-amber-400 mt-0.5 font-mono">
              {statement?.total_refusals ?? 0}
            </div>
            <div className="text-[10px] text-slate-500">Recorded refusal attempts</div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Chain Tip Hash</div>
            <div className="text-xs font-mono text-cyan-300 truncate mt-1 flex items-center space-x-1" title={account.last_entry_hash || 'None'}>
              <Hash className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>{account.last_entry_hash ? account.last_entry_hash.slice(0, 14) + '...' : 'Genesis'}</span>
            </div>
            <div className="text-[10px] text-slate-500">Latest cryptographic tip</div>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="px-5 py-2.5 border-b border-slate-800/80 flex items-center justify-between text-xs bg-[#070b13]">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                filter === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              All Events ({combinedItems.length})
            </button>
            <button
              onClick={() => setFilter('postings')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                filter === 'postings'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <CheckCircle className="w-3 h-3" />
              <span>Settled Entries ({statement?.total_entries ?? 0})</span>
            </button>
            <button
              onClick={() => setFilter('refusals')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                filter === 'refusals'
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Durable Refusals ({statement?.total_refusals ?? 0})</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:block font-mono">
            Immutable Audit Trail
          </div>
        </div>

        {/* Activity Items List */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3.5 bg-[#080c15]">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading cryptographic ledger entries...
            </div>
          ) : error ? (
            <div className="text-center py-16 text-rose-400 text-sm">{error}</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              No transaction or refusal records exist for this account yet.
            </div>
          ) : (
            filteredItems.map((item) => {
              if (item.itemType === 'entry') {
                const isCredit = item.amount_paise > 0;
                return (
                  <div
                    key={`entry-${item.id}`}
                    className="p-4 bg-[#0a0f1b] border border-slate-800/80 hover:border-emerald-500/40 rounded-xl transition-all shadow-sm group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3.5">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                            isCredit
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                              : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black uppercase text-white tracking-wide font-mono">
                              {item.transaction_type}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                              Entry #{item.entry_number}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-900/50">
                              SETTLED
                            </span>
                          </div>
                          <div className="text-xs text-slate-300 mt-1 font-medium">
                            {item.reason || 'Double-entry transfer'}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center space-x-2 mt-1 font-mono">
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{new Date(item.created_at).toLocaleString()}</span>
                            </span>
                            <span>&middot;</span>
                            <span className="text-slate-400 truncate max-w-[150px]">
                              Tx: {item.ledger_transaction_id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-base font-black font-mono tracking-tight ${
                            isCredit ? 'text-emerald-400' : 'text-slate-100'
                          }`}
                        >
                          {isCredit ? '+' : ''}₹
                          {(item.amount_paise / 100).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Bal: ₹
                          {(item.running_balance_paise / 100).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Cryptographic Link Chain Box */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 bg-slate-950/60 -mx-4 -mb-4 p-3 rounded-b-xl grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                      <div className="flex items-center justify-between bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-800">
                        <div className="truncate mr-2">
                          <span className="text-slate-500 font-semibold">Entry Hash: </span>
                          <span className="text-emerald-400">{item.entry_hash.slice(0, 20)}...</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(item.entry_hash)}
                          title="Copy Full Entry Hash"
                          className="text-slate-500 hover:text-emerald-400 transition shrink-0"
                        >
                          {copiedHash === item.entry_hash ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-800">
                        <div className="truncate mr-2">
                          <span className="text-slate-500 font-semibold">Prev Hash: </span>
                          <span className="text-cyan-400">
                            {item.prev_hash ? `${item.prev_hash.slice(0, 20)}...` : 'Genesis (0x0)'}
                          </span>
                        </div>
                        {item.prev_hash && (
                          <button
                            onClick={() => copyToClipboard(item.prev_hash!)}
                            title="Copy Full Previous Hash"
                            className="text-slate-500 hover:text-cyan-400 transition shrink-0"
                          >
                            {copiedHash === item.prev_hash ? (
                              <Check className="w-3 h-3 text-cyan-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Refusal Record
                return (
                  <div
                    key={`refusal-${item.id}`}
                    className="p-4 bg-amber-950/15 border border-amber-900/50 hover:border-amber-700/60 rounded-xl transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3.5">
                        <div className="w-9 h-9 rounded-lg bg-amber-950/80 text-amber-400 border border-amber-800/80 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black uppercase text-amber-300 tracking-wide font-mono">
                              Refused {item.request_type}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 uppercase font-mono">
                              {item.reason_code || 'INSUFFICIENT_FUNDS'}
                            </span>
                          </div>
                          <div className="text-xs text-amber-200/90 mt-1">
                            Safely rejected by ACID concurrency guard. No money deducted, ledger conserved.
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{new Date(item.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-amber-400/70 line-through">
                          ₹{(item.amount_paise / 100).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mt-0.5">
                          Durable Refusal Log
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
