import {
  LoginResponse,
  User,
  Account,
  AccountStatement,
  LedgerVerificationReport,
  AuditLog,
} from '../types';

const TOKEN_KEY = 'ledgerline_token';
const USER_KEY = 'ledgerline_user';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser: (): User | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  saveSession: (token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  idempotencyKey?: string
): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    authStorage.clearSession();
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.detail || `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

export const api = {
  // Auth
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const data = await request<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    authStorage.saveSession(data.token, data.user);
    return data;
  },

  register: async (email: string, full_name: string, password: string, role: string = 'holder'): Promise<User> => {
    return request<User>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, full_name, password, role }),
    });
  },

  getMe: async (): Promise<User> => {
    return request<User>('/api/v1/auth/me');
  },

  logout: async (): Promise<void> => {
    try {
      await request('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      authStorage.clearSession();
    }
  },

  // Accounts
  getAccounts: async (): Promise<Account[]> => {
    return request<Account[]>('/api/v1/accounts');
  },

  createAccount: async (account_name: string, currency: string = 'INR', overdraft_limit_paise: number = 0): Promise<Account> => {
    return request<Account>('/api/v1/accounts', {
      method: 'POST',
      body: JSON.stringify({ account_name, currency, overdraft_limit_paise }),
    });
  },

  freezeAccount: async (accountId: string): Promise<Account> => {
    return request<Account>(`/api/v1/accounts/${accountId}/freeze`, {
      method: 'PATCH',
    });
  },

  unfreezeAccount: async (accountId: string): Promise<Account> => {
    return request<Account>(`/api/v1/accounts/${accountId}/unfreeze`, {
      method: 'PATCH',
    });
  },

  // Transactions
  deposit: async (
    target_account_id: string,
    amount_paise: number,
    reason?: string,
    idempotencyKey?: string
  ) => {
    return request(
      '/api/v1/transactions/deposits',
      {
        method: 'POST',
        body: JSON.stringify({ target_account_id, amount_paise, reason }),
      },
      idempotencyKey || crypto.randomUUID()
    );
  },

  withdraw: async (
    source_account_id: string,
    amount_paise: number,
    reason?: string,
    idempotencyKey?: string
  ) => {
    return request(
      '/api/v1/transactions/withdrawals',
      {
        method: 'POST',
        body: JSON.stringify({ source_account_id, amount_paise, reason }),
      },
      idempotencyKey || crypto.randomUUID()
    );
  },

  transfer: async (
    source_account_id: string,
    target_account_id: string,
    amount_paise: number,
    reason?: string,
    idempotencyKey?: string
  ) => {
    return request(
      '/api/v1/transactions/transfers',
      {
        method: 'POST',
        body: JSON.stringify({ source_account_id, target_account_id, amount_paise, reason }),
      },
      idempotencyKey || crypto.randomUUID()
    );
  },

  // Audit
  getStatement: async (accountId: string): Promise<AccountStatement> => {
    return request<AccountStatement>(`/api/v1/audit/statements/${accountId}`);
  },

  verifyLedger: async (accountId?: string): Promise<LedgerVerificationReport> => {
    const url = accountId ? `/api/v1/audit/verify/${accountId}` : '/api/v1/audit/verify';
    return request<LedgerVerificationReport>(url);
  },

  getAuditLogs: async (limit: number = 100): Promise<AuditLog[]> => {
    return request<AuditLog[]>(`/api/v1/audit/logs?limit=${limit}`);
  },

  // Health
  checkHealth: async () => {
    return request<{ status: string; database: string }>('/api/v1/health/ready');
  },
};

