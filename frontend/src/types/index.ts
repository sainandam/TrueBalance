export type UserRole = 'admin' | 'holder' | 'auditor';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: string;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  token_type: string;
  expires_at: string;
  user: User;
}

export interface Account {
  id: string;
  account_number: string;
  account_name: string;
  currency: string;
  balance_paise: number;
  overdraft_limit_paise: number;
  status: 'active' | 'frozen' | 'closed';
  is_system: boolean;
  created_at: string;
  current_user_role?: string;
  last_entry_hash?: string | null;
}

export interface StatementEntry {
  id: string;
  ledger_transaction_id: string;
  transaction_type: string;
  entry_number: number;
  amount_paise: number;
  running_balance_paise: number;
  prev_hash: string | null;
  entry_hash: string;
  reason?: string | null;
  created_at: string;
}

export interface StatementAttempt {
  id: string;
  request_type: string;
  source_account_id?: string | null;
  target_account_id?: string | null;
  amount_paise: number;
  outcome: 'accepted' | 'refused';
  reason_code?: string | null;
  created_at: string;
}

export interface AccountStatement {
  account_id: string;
  account_number: string;
  account_name: string;
  current_balance_paise: number;
  currency: string;
  entries: StatementEntry[];
  refusal_attempts: StatementAttempt[];
  total_entries: number;
  total_refusals: number;
}

export interface TamperedEntryDetail {
  account_id: string;
  entry_id: string;
  entry_number: number;
  issue: string;
  expected_hash?: string | null;
  actual_hash?: string | null;
}

export interface LedgerVerificationReport {
  is_valid: boolean;
  checked_at: string;
  accounts_verified: number;
  total_entries: number;
  total_transactions: number;
  global_sum_paise: number;
  global_sum_is_zero: boolean;
  tampered_entries: TamperedEntryDetail[];
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  description?: string | null;
  details?: Record<string, any> | null;
  created_at: string;
}
