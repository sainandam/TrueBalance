import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { LedgerVerificationReport, AuditLog } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Database,
  Hash,
  AlertOctagon,
  Search,
  Filter,
} from 'lucide-react';

export const AuditorView: React.FC = () => {
  const [report, setReport] = useState<LedgerVerificationReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const runVerification = async () => {
    setVerifying(true);
    try {
      const data = await api.verifyLedger();
      setReport(data);
    } catch (err) {
      alert('Verification request failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setVerifying(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await api.getAuditLogs(150);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    runVerification();
    loadAuditLogs();
  }, []);

  const filteredLogs = auditLogs.filter((l) => {
    if (!logFilter) return true;
    const term = logFilter.toLowerCase();
    return (
      l.action.toLowerCase().includes(term) ||
      (l.description && l.description.toLowerCase().includes(term)) ||
      (l.target_type && l.target_type.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-8">
      {/* Cockpit Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">
              AUDIT & GOVERNANCE COCKPIT
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">Cryptographic Ledger Verification</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time mathematical validation of SHA-256 hash chains and zero-sum double-entry invariants.
          </p>
        </div>

        <button
          onClick={runVerification}
          disabled={verifying}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 transition flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
          <span>{verifying ? 'Recomputing Hashes...' : 'Re-verify Entire Ledger'}</span>
        </button>
      </div>

      {/* Verification Results Panel */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`p-6 rounded-2xl border shadow-xl ${
            report.is_valid
              ? 'bg-emerald-950/20 border-emerald-800/60'
              : 'bg-rose-950/20 border-rose-800/60'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overall Integrity</span>
              {report.is_valid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400" />
              )}
            </div>
            <div className={`text-2xl font-extrabold tracking-tight ${
              report.is_valid ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {report.is_valid ? 'VALID & UNBROKEN' : 'TAMPERED / FAILED'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {report.tampered_entries.length === 0
                ? 'All SHA-256 hash chains verified'
                : `${report.tampered_entries.length} anomalies detected`}
            </div>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Global Zero-Sum</span>
              <Database className="w-5 h-5 text-teal-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">
              {report.global_sum_paise} <span className="text-sm font-normal text-slate-400">paise</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Invariant: <span className="text-emerald-400 font-semibold">&sum; amount_paise = 0</span> ({report.global_sum_is_zero ? 'Preserved' : 'Violated'})
            </div>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Accounts Audited</span>
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">
              {report.accounts_verified}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Active accounts verified against balances
            </div>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Ledger Entries</span>
              <Hash className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">
              {report.total_entries}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Across {report.total_transactions} atomic transactions
            </div>
          </div>
        </div>
      )}

      {/* Tampered Entries Breakdown (if any) */}
      {report && report.tampered_entries.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-800/80 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center space-x-3 mb-4">
            <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-rose-300">Integrity Violations Detected</h3>
              <p className="text-xs text-rose-400">Cryptographic audit has identified anomalous ledger nodes.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-rose-900/60 text-rose-400 uppercase">
                <tr>
                  <th className="py-2 px-3">Account ID</th>
                  <th className="py-2 px-3">Entry ID</th>
                  <th className="py-2 px-3">Issue Description</th>
                  <th className="py-2 px-3">Expected Hash</th>
                  <th className="py-2 px-3">Actual Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-900/40 text-rose-200">
                {report.tampered_entries.map((t, idx) => (
                  <tr key={idx} className="hover:bg-rose-950/40">
                    <td className="py-2 px-3 truncate max-w-[120px]" title={t.account_id}>{t.account_id}</td>
                    <td className="py-2 px-3 truncate max-w-[120px]" title={t.entry_id}>{t.entry_id}</td>
                    <td className="py-2 px-3 text-rose-300 font-sans font-semibold">{t.issue}</td>
                    <td className="py-2 px-3 truncate max-w-[120px]" title={t.expected_hash || 'None'}>{t.expected_hash || 'None'}</td>
                    <td className="py-2 px-3 truncate max-w-[120px]" title={t.actual_hash || 'None'}>{t.actual_hash || 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supervisory Audit Logs Trail */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">Immutable Audit Trail</h3>
            <p className="text-xs text-slate-400">Append-only audit events logged by database and security service.</p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              placeholder="Search action or description..."
              className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 w-full sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400 uppercase font-semibold sticky top-0 bg-slate-900">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Target</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loadingLogs ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500">Loading audit records...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500">No matching audit events found.</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/60">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {log.target_type ? `${log.target_type}:${log.target_id?.slice(0, 8)}...` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">
                      {log.description || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {log.details && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-[11px] text-teal-400 hover:underline font-mono"
                        >
                          View JSON
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white font-mono">
                Audit Event: {selectedLog.action}
              </h4>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto max-h-96">
              {JSON.stringify(selectedLog.details, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
