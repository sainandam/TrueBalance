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
import {
  Wallet,
  Plus,
  ArrowLeftRight,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Coins,
} from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'loading'>('loading');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'audit'>('dashboard');
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
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
        ) : activeTab === 'audit' ? (
          <AuditorView />
        ) : (
          <div className="space-y-8">
            {/* Dashboard Overview Banner */}
            <div className="p-8 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                    <Coins className="w-4 h-4" />
                    <span>Portfolio Overview &middot; {user.role.toUpperCase()}</span>
                  </div>
                  <h1 className="text-3xl font-extrabold text-white mt-1">
                    Welcome back, {user.full_name}
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    All accounts protected by ACID row-level locking &amp; SHA-256 cryptographic hash chains.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setIsCreateAccountOpen(true)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Open Account</span>
                  </button>

                  <button
                    onClick={() => setTxModal({ type: 'transfer' })}
                    disabled={accounts.length < 2}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 transition flex items-center space-x-2 disabled:opacity-40"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>New Transfer</span>
                  </button>
                </div>
              </div>

              {/* Quick Net Worth Bar */}
              <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-8 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block font-sans text-[11px] uppercase">Combined Assets</span>
                  <span className="text-xl font-bold text-white">
                    ₹{(totalBalancePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans text-[11px] uppercase">Total Active Accounts</span>
                  <span className="text-xl font-bold text-emerald-400">{accounts.length}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans text-[11px] uppercase">Engine Standard</span>
                  <span className="text-sm font-semibold text-teal-300">Double-Entry Paired Ledger</span>
                </div>
              </div>
            </div>

            {/* Accounts Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-bold text-white">Your Managed Accounts</h3>
                </div>
                <button
                  onClick={loadAccounts}
                  disabled={loadingAccounts}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
                  title="Refresh Accounts"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingAccounts ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingAccounts ? (
                <div className="text-center py-16 text-slate-400 text-sm">Loading financial accounts...</div>
              ) : accounts.length === 0 ? (
                <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
                  <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-white">No accounts found</h4>
                  <p className="text-xs text-slate-400 mt-1 mb-4">
                    Get started by creating your first double-entry ledger account.
                  </p>
                  <button
                    onClick={() => setIsCreateAccountOpen(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
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

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        LedgerLine TrueBalance &middot; Snovasys Fresher Challenge 2026 &middot; Double-Entry Financial Engine &middot; Real PostgreSQL 18.6 ACID Row Locks
      </footer>
    </div>
  );
}

export default App;
