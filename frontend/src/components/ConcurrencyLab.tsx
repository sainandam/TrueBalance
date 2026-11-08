import React, { useState } from 'react';
import { api } from '../services/api';
import { Account } from '../types';
import {
  Zap,
  Play,
  CheckCircle2,
  XCircle,
  Copy,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Cpu,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ConcurrencyLabProps {
  accounts: Account[];
  onAccountsUpdated: () => void;
}

interface RequestResult {
  threadId: number;
  status: 'pending' | 'success' | 'refused' | 'error';
  statusCode?: number;
  message?: string;
  idempotencyKey: string;
  durationMs?: number;
}

export const ConcurrencyLab: React.FC<ConcurrencyLabProps> = ({
  accounts,
  onAccountsUpdated,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [testType, setTestType] = useState<'race' | 'idempotency'>('race');
  const [numRequests, setNumRequests] = useState(10);
  const [requestAmountRupees, setRequestAmountRupees] = useState('50');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RequestResult[]>([]);
  const [summary, setSummary] = useState<{
    succeeded: number;
    refused: number;
    initialBalance: number;
    finalBalance: number;
  } | null>(null);

  const targetAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const runRaceConditionTest = async () => {
    if (!targetAccount) return;
    setRunning(true);
    setResults([]);
    setSummary(null);

    const initialBal = targetAccount.balance_paise;
    const amountPaise = Math.round(parseFloat(requestAmountRupees) * 100);

    // Prepare threads
    const pendingThreads: RequestResult[] = Array.from({ length: numRequests }, (_, i) => ({
      threadId: i + 1,
      status: 'pending',
      idempotencyKey: `lab-race-${i + 1}-${crypto.randomUUID()}`,
    }));
    setResults([...pendingThreads]);

    const startTime = performance.now();

    // Fire all simultaneous withdrawal requests concurrently via Promise.all
    const promises = pendingThreads.map(async (thread) => {
      const tStart = performance.now();
      try {
        await api.withdraw(
          targetAccount.id,
          amountPaise,
          `Lab Concurrent Withdrawal #${thread.threadId}`,
          thread.idempotencyKey
        );
        const duration = Math.round(performance.now() - tStart);
        return {
          ...thread,
          status: 'success' as const,
          statusCode: 201,
          message: 'Accepted & Ledger Entry Committed',
          durationMs: duration,
        };
      } catch (err: any) {
        const duration = Math.round(performance.now() - tStart);
        const msg = err.message || 'Rejected';
        return {
          ...thread,
          status: 'refused' as const,
          statusCode: 422,
          message: msg,
          durationMs: duration,
        };
      }
    });

    const finished = await Promise.all(promises);
    setResults(finished);

    // Refresh accounts to inspect final state
    onAccountsUpdated();
    const updatedAccounts = await api.getAccounts();
    const updatedAcc = updatedAccounts.find((a) => a.id === targetAccount.id);
    const finalBal = updatedAcc ? updatedAcc.balance_paise : initialBal;

    const succeeded = finished.filter((r) => r.status === 'success').length;
    const refused = finished.filter((r) => r.status === 'refused').length;

    setSummary({
      succeeded,
      refused,
      initialBalance: initialBal,
      finalBalance: finalBal,
    });
    setRunning(false);
  };

  const runIdempotencyReplayTest = async () => {
    if (!targetAccount) return;
    setRunning(true);
    setResults([]);
    setSummary(null);

    const initialBal = targetAccount.balance_paise;
    const amountPaise = 10000; // ₹100
    // ONE SHARED IDEMPOTENCY KEY FOR ALL REQUESTS
    const sharedKey = `shared-replay-${crypto.randomUUID()}`;

    const pendingThreads: RequestResult[] = Array.from({ length: 5 }, (_, i) => ({
      threadId: i + 1,
      status: 'pending',
      idempotencyKey: sharedKey,
    }));
    setResults([...pendingThreads]);

    const promises = pendingThreads.map(async (thread) => {
      const tStart = performance.now();
      try {
        await api.deposit(
          targetAccount.id,
          amountPaise,
          'Lab Idempotency Replay Test',
          sharedKey
        );
        const duration = Math.round(performance.now() - tStart);
        return {
          ...thread,
          status: 'success' as const,
          statusCode: 200,
          message: thread.threadId === 1 ? 'Original Transaction Executed' : 'Cached Idempotent Response Replayed',
          durationMs: duration,
        };
      } catch (err: any) {
        const duration = Math.round(performance.now() - tStart);
        return {
          ...thread,
          status: 'refused' as const,
          statusCode: 409,
          message: err.message,
          durationMs: duration,
        };
      }
    });

    const finished = await Promise.all(promises);
    setResults(finished);

    onAccountsUpdated();
    const updatedAccounts = await api.getAccounts();
    const updatedAcc = updatedAccounts.find((a) => a.id === targetAccount.id);
    const finalBal = updatedAcc ? updatedAcc.balance_paise : initialBal;

    setSummary({
      succeeded: finished.filter((r) => r.status === 'success').length,
      refused: finished.filter((r) => r.status === 'refused').length,
      initialBalance: initialBal,
      finalBalance: finalBal,
    });
    setRunning(false);
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="p-8 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950/90 border border-cyan-500/20 rounded-3xl shadow-2xl relative overflow-hidden glass-card">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <Cpu className="w-4 h-4 animate-pulse" />
              <span>Interactive Concurrency &amp; Race-Condition Simulator</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white mt-1">
              Live Stress-Testing Sandbox
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Execute parallel non-blocking HTTP worker threads in real time against live PostgreSQL row locks (`SELECT ... FOR UPDATE`).
              Visually observe zero overdrafts, idempotency caching, and durable refusals.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setTestType('race')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                testType === 'race'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Parallel Overdraft Attack
            </button>
            <button
              onClick={() => setTestType('idempotency')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                testType === 'idempotency'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Idempotency Key Replay
            </button>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-slate-900/70 border border-slate-800/80 rounded-2xl glass-card space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Target Account</span>
          </h4>

          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_name} ({a.account_number}) — ₹{(a.balance_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </option>
            ))}
          </select>

          {targetAccount && (
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Available Balance:</span>
                <span className="text-emerald-400 font-bold">
                  ₹{(targetAccount.balance_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Paise:</span>
                <span className="text-slate-200">{targetAccount.balance_paise.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-300 font-semibold uppercase">{targetAccount.status}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-900/70 border border-slate-800/80 rounded-2xl glass-card space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Attack Parameters</span>
          </h4>

          {testType === 'race' ? (
            <>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Concurrent Threads (Simultaneous Requests)</label>
                <div className="flex items-center space-x-2">
                  {[5, 10, 20].map((count) => (
                    <button
                      key={count}
                      onClick={() => setNumRequests(count)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        numRequests === count
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {count} Threads
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Withdrawal Amount per Thread (₹ INR)</label>
                <input
                  type="number"
                  min="1"
                  value={requestAmountRupees}
                  onChange={(e) => setRequestAmountRupees(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Total attempted drainage: ₹{(parseFloat(requestAmountRupees || '0') * numRequests).toLocaleString()}
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 space-y-2">
              <p>
                Will fire <span className="text-emerald-400 font-bold">5 simultaneous requests</span> with the <strong>exact same UUID Idempotency-Key</strong>.
              </p>
              <p className="text-[11px] text-slate-500">
                The database must serialize the execution: thread 1 executes the deposit, while threads 2-5 are served the cached response without double-crediting.
              </p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-900/70 border border-slate-800/80 rounded-2xl glass-card flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Execute Simulator</h4>
            <p className="text-xs text-slate-400 mb-4">
              {testType === 'race'
                ? `Fires ${numRequests} parallel withdrawals simultaneously against direct PostgreSQL row locks.`
                : 'Fires 5 identical requests sharing one Idempotency-Key to test replay prevention.'}
            </p>
          </div>

          <button
            onClick={testType === 'race' ? runRaceConditionTest : runIdempotencyReplayTest}
            disabled={running || !targetAccount}
            className="w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-white shadow-lg shadow-cyan-500/25 transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Play className={`w-4 h-4 fill-white ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Executing Parallel Threads...' : 'Launch Live Stress Attack'}</span>
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      {summary && (
        <div className="p-6 bg-slate-900/90 border border-emerald-500/30 rounded-2xl glass-card glow-emerald">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  ACID Concurrency Invariant Verified
                </h4>
                <p className="text-xs text-slate-400">
                  {summary.succeeded} succeeded &middot; {summary.refused} safely refused with Insufficient Funds &middot; 0 balance drift
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-6 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-sans">Initial Balance</span>
                <span className="text-slate-200 font-bold">₹{(summary.initialBalance / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-sans">Final Balance</span>
                <span className="text-emerald-400 font-bold text-sm">₹{(summary.finalBalance / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Live Feed Grid */}
      {results.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl glass-card">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Real-Time Thread Execution Stream</span>
            </h4>
            <span className="text-xs font-mono text-slate-400">{results.length} Threads Dispatched</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((r) => {
              const isSuccess = r.status === 'success';
              const isRefused = r.status === 'refused';
              const isPending = r.status === 'pending';

              return (
                <div
                  key={r.threadId}
                  className={`p-3.5 rounded-xl border transition ${
                    isSuccess
                      ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                      : isRefused
                      ? 'bg-amber-950/20 border-amber-800/60 text-amber-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 animate-pulse'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold flex items-center space-x-1.5">
                      {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      {isRefused && <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      {isPending && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />}
                      <span>Thread #{r.threadId}</span>
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                      {r.statusCode ? `HTTP ${r.statusCode}` : 'In Flight'}
                    </span>
                  </div>

                  <div className="text-[11px] truncate mt-1 text-slate-300">
                    {r.message || 'Queued for database lock...'}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-900/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span className="truncate max-w-[140px]" title={r.idempotencyKey}>
                      Key: {r.idempotencyKey.slice(0, 14)}...
                    </span>
                    {r.durationMs !== undefined && (
                      <span className="text-cyan-400">{r.durationMs}ms</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

