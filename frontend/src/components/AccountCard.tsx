import React from 'react';
import { Account } from '../types';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  FileText,
  Lock,
  Unlock,
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
  const isFrozen = account.status === 'frozen';
  const balanceRupees = (account.balance_paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className={`p-6 bg-slate-900 border rounded-2xl shadow-xl transition relative overflow-hidden flex flex-col justify-between ${
      isFrozen ? 'border-amber-900/50 bg-slate-900/60' : 'border-slate-800 hover:border-slate-700'
    }`}>
      {/* Top Bar */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isFrozen ? 'bg-amber-950 text-amber-400' : 'bg-slate-800 text-emerald-400'
            }`}>
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white tracking-tight">{account.account_name}</h4>
              <span className="text-xs font-mono text-slate-400">{account.account_number}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
              isFrozen
                ? 'bg-amber-950/80 text-amber-400 border-amber-800'
                : 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
            }`}>
              {account.status}
            </span>

            {isAdmin && onToggleFreeze && (
              <button
                onClick={() => onToggleFreeze(account)}
                title={isFrozen ? 'Unfreeze Account' : 'Freeze Account'}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
              >
                {isFrozen ? <Unlock className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-amber-400" />}
              </button>
            )}
          </div>
        </div>

        {/* Balance Display */}
        <div className="my-4">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Available Balance</div>
          <div className="text-3xl font-extrabold text-white mt-0.5 font-mono">
            ₹{balanceRupees}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            {account.balance_paise.toLocaleString()} paise &middot; {account.currency}
          </div>
          {account.overdraft_limit_paise > 0 && (
            <div className="text-[11px] text-amber-400/90 font-mono mt-1">
              Overdraft Limit: ₹{(account.overdraft_limit_paise / 100).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-4 gap-2">
        <button
          onClick={() => onDeposit(account)}
          disabled={isFrozen}
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-emerald-400 transition disabled:opacity-40"
        >
          <ArrowDownLeft className="w-4 h-4 mb-1" />
          <span className="text-[10px] font-semibold">Deposit</span>
        </button>

        <button
          onClick={() => onWithdraw(account)}
          disabled={isFrozen}
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-amber-400 transition disabled:opacity-40"
        >
          <ArrowUpRight className="w-4 h-4 mb-1" />
          <span className="text-[10px] font-semibold">Withdraw</span>
        </button>

        <button
          onClick={() => onTransfer(account)}
          disabled={isFrozen}
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-blue-400 transition disabled:opacity-40"
        >
          <ArrowLeftRight className="w-4 h-4 mb-1" />
          <span className="text-[10px] font-semibold">Transfer</span>
        </button>

        <button
          onClick={() => onViewStatement(account)}
          className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 transition"
        >
          <FileText className="w-4 h-4 mb-1" />
          <span className="text-[10px] font-semibold">Statement</span>
        </button>
      </div>
    </div>
  );
};
