import React, { useState, useEffect } from 'react';
import { api, authStorage } from './services/api';
import { User, Account } from './types';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { AccountCard } from './components/AccountCard';
import { TransactionModal } from './components/TransactionModal';
import { StatementModal } from './components/StatementModal';
import { CreateAccountModal } from './components/CreateAccountModal';
import { AuditorView } from './components/AuditorView';
import { ConcurrencyLab } from './components/ConcurrencyLab';
import {
  Wallet,
  Plus,
  ArrowLeftRight,
  ShieldCheck,
  RefreshCw,
  Coins,
  Zap,
  Activity,
  ArrowRight,
  Lock,
} from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'loading'>('loading');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'audit' | 'lab'>('dashboard');
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Modals state
  const [txModal, setTxModal] = useState<{
    type: 'deposit' | 'withdraw' | 'transfer';
    sourceAccount?: Account;
  } | null>(null);
  const [statementAccount, setStatementAccount] = useState<Account | null>(null);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);

  // Initial load: check health and cached user session
  useEffect(() => {
    const initApp = async () => {
      try {
        const health = await api.checkHealth();
        if (health.status === 'ready') {
          setDbStatus('connected');
        } else {
          setDbStatus('error');
        }
      } catch {
        setDbStatus('error');
      }

      const cachedToken = authStorage.getToken();
      if (cachedToken) {
        try {
          const me = await api.getMe();
          setUser(me);
          if (me.role === 'auditor') {
            setActiveTab('audit');
          }
        } catch {
          authStorage.clearSession();
          setUser(null);
        }
      }
    };

    initApp();

    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Fetch accounts when user logs in
  const loadAccounts = async () => {
    if (!user) return;
    setLoadingAccounts(true);
    try {
      const data = await api.getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadAccounts();
    } else {
      setAccounts([]);
    }
  }, [user]);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setAccounts([]);
    setActiveTab('dashboard');
  };

  const handleToggleFreeze = async (account: Account) => {
    try {
      if (account.status === 'frozen') {
        await api.unfreezeAccount(account.id);
      } else {
        await api.freezeAccount(account.id);
      }
      loadAccounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  // Compute total aggregate net worth across active customer accounts
  const totalBalancePaise = accounts
    .filter((a) => !a.is_system)
    .reduce((sum, a) => sum + a.balance_paise, 0);

  return (
    <div className="min-h-screen bg-[#04060b] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navbar
        user={user}
        dbStatus={dbStatus}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={(t) => setActiveTab(t as any)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!user ? (
          <AuthModal
            onSuccess={(u) => {
              setUser(u);
              if (u.role === 'auditor') {
                setActiveTab('audit');
              }
            }}
          />
        ) : activeTab === 'lab' ? (
          <ConcurrencyLab accounts={accounts} onAccountsUpdated={loadAccounts} />
        ) : activeTab === 'audit' ? (
          <AuditorView />
        ) : (
          <div className="space-y-8 animate-fadeIn">
            {/* Dashboard Overview Banner */}
            <div className="p-8 sm:p-9 bg-gradient-to-r from-[#070b14] via-[#090e1c] to-[#060810] border border-emerald-950/70 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                    <Coins className="w-4 h-4" />
                    <span>Vault Portfolio &middot; {user.role.toUpperCase()}</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-black text-white mt-1 tracking-tight">
                    Welcome back, {user.full_name}
                  </h1>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                    Financial ledgers protected by PostgreSQL 18.6 row-level ACID locks &amp; SHA-256 cryptographic provenance chains.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setIsCreateAccountOpen(true)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 transition flex items-center space-x-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Open Account</span>
                  </button>

                  <button
                    onClick={() => setTxModal({ type: 'transfer' })}
                    disabled={accounts.length < 2}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 transition flex items-center space-x-2 disabled:opacity-40"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Transfer</span>
                  </button>
                </div>
              </div>

              {/* Quick Net Worth Bar */}
              <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block font-sans text-[11px] uppercase tracking-wider">
                    Total Aggregate Assets
                  </span>
                  <span className="text-2xl font-black text-white mt-0.5 tracking-tight block">
                    ₹{(totalBalancePaise / 100).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-[10px] text-emerald-400/90 block mt-0.5">
                    {totalBalancePaise.toLocaleString()} paise (64-bit)
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-sans text-[11px] uppercase tracking-wider">
                    Managed Vault Accounts
                  </span>
                  <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
                    {accounts.length}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Zero-Sum Conserved
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-sans text-[11px] uppercase tracking-wider">
                    Precision Standard
                  </span>
                  <span className="text-sm font-bold text-teal-300 mt-1 block">
                    Integer Paise Precision
                  </span>
                  <span className="text-[10px] text-slate-500 block">0.00% Floating Drift</span>
                </div>

                <div>
                  <span className="text-slate-400 block font-sans text-[11px] uppercase tracking-wider">
                    Immutability Guard
                  </span>
                  <span className="text-sm font-bold text-cyan-300 mt-1 block flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 inline" />
                    <span>PL/pgSQL Triggers</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block">Kernel UPDATE/DELETE Blocked</span>
                </div>
              </div>
            </div>

            {/* Interactive Feature Callout: Concurrency Lab Promo */}
            <div className="p-5 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-950 border border-cyan-800/50 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-700/60 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-cyan-200 tracking-tight">
                    Interactive ACID Concurrency &amp; Race Condition Lab
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Launch 10 parallel overdraft requests at once to observe atomic row locking and zero-balance protection live!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('lab')}
                className="px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center space-x-2 self-start sm:self-auto shrink-0 shadow-lg shadow-cyan-600/25"
              >
                <span>Launch Test Lab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Accounts Grid */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center space-x-2.5">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Active Ledger Vault Accounts
                  </h3>
                </div>
                <button
                  onClick={loadAccounts}
                  disabled={loadingAccounts}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
                  title="Refresh Accounts"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingAccounts ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingAccounts ? (
                <div className="text-center py-20 text-slate-400 text-sm">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Synchronizing accounts from PostgreSQL ledger...
                </div>
              ) : accounts.length === 0 ? (
                <div className="p-12 text-center bg-[#070b13] border border-slate-800 rounded-3xl">
                  <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-white">No accounts found</h4>
                  <p className="text-xs text-slate-400 mt-1 mb-4">
                    Get started by creating your first double-entry ledger account.
                  </p>
                  <button
                    onClick={() => setIsCreateAccountOpen(true)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider shadow-lg shadow-emerald-600/20"
                  >
                    Create Account Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {accounts.map((acc) => (
                    <AccountCard
                      key={acc.id}
                      account={acc}
                      onDeposit={(a) => setTxModal({ type: 'deposit', sourceAccount: a })}
                      onWithdraw={(a) => setTxModal({ type: 'withdraw', sourceAccount: a })}
                      onTransfer={(a) => setTxModal({ type: 'transfer', sourceAccount: a })}
                      onViewStatement={(a) => setStatementAccount(a)}
                      onToggleFreeze={user.role === 'admin' ? handleToggleFreeze : undefined}
                      isAdmin={user.role === 'admin'}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {txModal && (
        <TransactionModal
          type={txModal.type}
          sourceAccount={txModal.sourceAccount}
          accounts={accounts}
          onClose={() => setTxModal(null)}
          onSuccess={loadAccounts}
        />
      )}

      {statementAccount && (
        <StatementModal
          account={statementAccount}
          onClose={() => setStatementAccount(null)}
        />
      )}

      {isCreateAccountOpen && (
        <CreateAccountModal
          isAdmin={user?.role === 'admin'}
          onClose={() => setIsCreateAccountOpen(false)}
          onSuccess={loadAccounts}
        />
      )}

      <footer className="border-t border-slate-900/90 py-6 text-center text-xs text-slate-500 font-mono">
        TrueBalance LedgerLine &middot; Snovasys Fresher Challenge 2026 &middot; 64-bit Integer Paise Precision &middot; Real PostgreSQL 18.6 ACID Locks &middot; SHA-256 Provenance
      </footer>
    </div>
  );
}

export default App;
