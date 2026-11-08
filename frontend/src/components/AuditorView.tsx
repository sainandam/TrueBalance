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
  Eye,
  FileCode,
  Shield,
  Activity,
  Check,
  Radio,
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
      (l.target_type && l.target_type.toLowerCase().includes(term)) ||
      (l.actor_id && l.actor_id.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Cockpit Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 bg-[#070b13] border border-emerald-950/80 rounded-3xl shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 relative">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] uppercase font-mono font-black tracking-widest text-emerald-400">
                AUDITOR &amp; GOVERNANCE COCKPIT &middot; LEVEL 3 DEFENSE
              </span>
            </div>
            <h2 className="text-3xl font-black text-white mt-1 tracking-tight">
              Cryptographic Ledger Verification
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Real-time mathematical validation of SHA-256 hash chains, zero-sum conservation invariants (<span className="text-emerald-400 font-mono">&sum; amount_paise = 0</span>), and immutable PostgreSQL row security.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                runVerification();
                loadAuditLogs();
              }}
              disabled={verifying}
              className="px-5 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Recalculating Hashes...' : 'Re-verify Entire Ledger'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Verification KPI Cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className={`p-6 rounded-2xl border shadow-xl relative overflow-hidden transition-all ${
              report.is_valid
                ? 'bg-emerald-950/20 border-emerald-800/60'
                : 'bg-rose-950/20 border-rose-800/70'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Cryptographic Integrity
              </span>
              {report.is_valid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400" />
              )}
            </div>
            <div
              className={`text-2xl font-black tracking-tight font-mono ${
                report.is_valid ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {report.is_valid ? 'VALID & UNBROKEN' : 'TAMPERED / BROKEN'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {report.tampered_entries.length === 0
                ? 'All SHA-256 hash chains intact'
                : `${report.tampered_entries.length} cryptographic anomalies!`}
            </div>
          </div>

          <div className="p-6 bg-[#070b13] border border-slate-800 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Double-Entry Zero-Sum
              </span>
              <Database className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {report.global_sum_paise}{' '}
              <span className="text-xs font-normal text-slate-400">paise</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Invariant: <span className="text-emerald-400 font-bold">&sum; &Delta;paise = 0</span>{' '}
              ({report.global_sum_is_zero ? 'Strictly Conserved' : 'VIOLATED!'})
            </div>
          </div>

          <div className="p-6 bg-[#070b13] border border-slate-800 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Accounts Audited
              </span>
              <ShieldCheck className="w-5 h-5 text-teal-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {report.accounts_verified}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Active ledger accounts validated
            </div>
          </div>

          <div className="p-6 bg-[#070b13] border border-slate-800 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Total Ledger Nodes
              </span>
              <Hash className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {report.total_entries}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Across {report.total_transactions} atomic transactions
            </div>
          </div>
        </div>
      )}

      {/* Tampered Entries Alert (if any anomaly detected) */}
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

      {/* Supervisory Immutable Audit Trail */}
      <div className="bg-[#070b13] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-lg font-bold text-white tracking-tight">
                Supervisory Audit Trail
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Append-only audit events logged by database triggers and security middleware.
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              placeholder="Search action or target..."
              className="pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 w-full sm:w-72"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400 uppercase font-mono sticky top-0 bg-[#090d16] z-10">
              <tr>
                <th className="py-3 px-3.5">Timestamp</th>
                <th className="py-3 px-3.5">Action Event</th>
                <th className="py-3 px-3.5">Target Entity</th>
                <th className="py-3 px-3.5">Description</th>
                <th className="py-3 px-3.5 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-sans">
              {loadingLogs ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Fetching immutable audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No matching audit events found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-400 text-[11px]">
                      {log.target_type ? `${log.target_type}:${log.target_id?.slice(0, 8)}...` : '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-200 text-xs">
                      {log.description || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      {log.details ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-mono transition"
                        >
                          View JSON
                        </button>
                      ) : (
                        <span className="text-slate-600 font-mono text-[10px]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Details JSON Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-[#03060c]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#090d16] border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <FileCode className="w-5 h-5 text-emerald-400" />
                <h4 className="text-base font-bold text-white font-mono">Audit Record Payload</h4>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Action</span>
                  <span className="font-mono text-emerald-400 font-bold">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Target</span>
                  <span className="font-mono text-slate-300">{selectedLog.target_type || 'N/A'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono mb-1">Raw JSON Payload</span>
                <pre className="bg-[#04070e] p-3 rounded-xl border border-slate-800/80 text-[11px] font-mono text-emerald-300 max-h-60 overflow-auto">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
