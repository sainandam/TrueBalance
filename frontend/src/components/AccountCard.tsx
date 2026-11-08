import React, { useState } from 'react';
import { Account } from '../types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  FileText,
  Lock,
  Unlock,
  Copy,
  Check,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';

interface AccountCardProps {
  account: Account;
  onDeposit: (account: Account) => void;
  onWithdraw: (account: Account) => void;
  onTransfer: (account: Account) => void;
  onViewStatement: (account: Account) => void;
  onToggleFreeze?: (account: Account) => void;
  isAdmin?: boolean;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onDeposit,
  onWithdraw,
  onTransfer,
  onViewStatement,
  onToggleFreeze,
  isAdmin,
}) => {
  const [copied, setCopied] = useState(false);
  const isFrozen = account.status === 'frozen';
  const balanceRupees = (account.balance_paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const copyAccountNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(account.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`p-6 rounded-3xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between glass-card glass-card-hover group ${
        isFrozen ? 'border-amber-500/30' : 'border-white/10'
      }`}
    >
      {/* Decorative Card Gradient Mesh */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>

      {/* Top Bar: Bank Brand, Chip & Status */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {/* Virtual EMV Chip Graphic */}
            <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 border border-amber-200/40 p-1 flex items-center justify-between shadow-sm">
              <div className="w-2.5 h-full border-r border-amber-700/30"></div>
              <div className="w-2.5 h-full border-l border-amber-700/30"></div>
            </div>

            <div>
              <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                {account.is_system ? 'System Clearinghouse' : 'Sovereign Account'}
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">{account.account_name}</h4>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full border flex items-center space-x-1.5 ${
                isFrozen
                  ? 'bg-amber-950/80 text-amber-300 border-amber-700/80 glow-amber'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80 glow-emerald'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isFrozen ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}></span>
              <span>{account.status}</span>
            </span>

            {isAdmin && onToggleFreeze && (
              <button
                onClick={() => onToggleFreeze(account)}
                title={isFrozen ? 'Unfreeze Account' : 'Freeze Account'}
                className="p-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white transition"
              >
                {isFrozen ? <Unlock className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            )}
          </div>
        </div>

        {/* Account Number with 1-click copy */}
        <div className="flex items-center space-x-2 mb-4">
          <button
            onClick={copyAccountNumber}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-mono transition"
            title="Click to copy account number"
          >
            <span>{account.account_number}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
          </button>
          <span className="text-[10px] font-mono text-slate-500">{account.currency}</span>
        </div>

        {/* Big Balance Display */}
        <div className="my-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Available Balance</div>
          <div className="text-3xl font-black text-white mt-0.5 font-mono tracking-tight flex items-baseline space-x-1">
            <span className="text-emerald-400 text-2xl font-semibold">₹</span>
            <span>{balanceRupees}</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5 flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70" />
            <span>{account.balance_paise.toLocaleString()} paise &middot; SHA-256 Chained</span>
          </div>

          {account.overdraft_limit_paise > 0 && (
            <div className="text-[11px] text-amber-400 font-mono mt-1">
              Overdraft Facility: ₹{(account.overdraft_limit_paise / 100).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Matrix */}
      <div className="mt-5 pt-4 border-t border-white/5 grid grid-cols-4 gap-2">
        <button
          onClick={() => onDeposit(account)}
          disabled={isFrozen}
          className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-slate-950/60 hover:bg-emerald-950/40 border border-slate-800/80 hover:border-emerald-700/60 text-slate-300 hover:text-emerald-400 transition disabled:opacity-40"
        >
          <ArrowDownLeft className="w-4 h-4 mb-1 text-emerald-400" />
          <span className="text-[10px] font-semibold">Deposit</span>
        </button>

        <button
          onClick={() => onWithdraw(account)}
          disabled={isFrozen}
          className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-slate-950/60 hover:bg-amber-950/40 border border-slate-800/80 hover:border-amber-700/60 text-slate-300 hover:text-amber-400 transition disabled:opacity-40"
        >
          <ArrowUpRight className="w-4 h-4 mb-1 text-amber-400" />
          <span className="text-[10px] font-semibold">Withdraw</span>
        </button>

        <button
          onClick={() => onTransfer(account)}
          disabled={isFrozen}
          className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-slate-950/60 hover:bg-cyan-950/40 border border-slate-800/80 hover:border-cyan-700/60 text-slate-300 hover:text-cyan-400 transition disabled:opacity-40"
        >
          <ArrowLeftRight className="w-4 h-4 mb-1 text-cyan-400" />
          <span className="text-[10px] font-semibold">Transfer</span>
        </button>

        <button
          onClick={() => onViewStatement(account)}
          className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 hover:border-slate-600 text-slate-300 hover:text-white transition"
        >
          <FileText className="w-4 h-4 mb-1 text-slate-400" />
          <span className="text-[10px] font-semibold">Statement</span>
        </button>
      </div>
    </div>
  );
};
