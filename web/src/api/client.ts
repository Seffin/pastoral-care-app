/**
 * Thin fetch wrapper shared by every page. Talks to the SAME backend
 * API as the mobile client (see backend/src/api/*.routes.ts) — no
 * web-specific endpoints. Handles:
 *   - attaching the access token
 *   - transparently refreshing it once on a 401 and retrying
 *   - normalizing error responses into a typed ApiError
 *
 * Tokens are kept in memory + sessionStorage (not localStorage) so a
 * closed tab doesn't leave a long-lived credential sitting around
 * indefinitely, while a refresh/reload within the same tab survives.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: unknown) {
    super(code);
  }
}

interface TokenState {
  accessToken: string | null;
  refreshToken: string | null;
}

const tokenState: TokenState = {
  accessToken: sessionStorage.getItem('accessToken'),
  refreshToken: sessionStorage.getItem('refreshToken'),
};

export function setTokens(accessToken: string | null, refreshToken: string | null): void {
  tokenState.accessToken = accessToken;
  tokenState.refreshToken = refreshToken;

  if (accessToken) sessionStorage.setItem('accessToken', accessToken);
  else sessionStorage.removeItem('accessToken');

  if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
  else sessionStorage.removeItem('refreshToken');
}

export function isAuthenticated(): boolean {
  return Boolean(tokenState.accessToken);
}

async function refreshAccessToken(): Promise<boolean> {
  if (!tokenState.refreshToken) return false;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokenState.refreshToken }),
  });

  if (!res.ok) {
    setTokens(null, null);
    return false;
  }

  const data = await res.json();
  setTokens(data.accessToken, tokenState.refreshToken);
  return true;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  _retried?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(tokenState.accessToken ? { Authorization: `Bearer ${tokenState.accessToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options._retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    let payload: { error?: string; details?: unknown } = {};
    try {
      payload = await res.json();
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, payload.error ?? 'unknown_error', payload.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    apiRequest<{ accessToken: string; refreshToken: string; expiresIn: number }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  listMembers: (params: { limit?: number; offset?: number; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.status) query.set('status', params.status);
    return apiRequest<{ members: MemberSummary[]; limit: number; offset: number }>(
      `/members?${query.toString()}`
    );
  },

  getMember: (id: string) => apiRequest<MemberDetail>(`/members/${id}`),

  createMember: (input: CreateMemberInput) =>
    apiRequest<{ id: string }>('/members', { method: 'POST', body: input }),

  logVisit: (input: LogVisitInput) =>
    apiRequest<{ id: string; deduplicated: boolean }>('/visits', { method: 'POST', body: input }),

  listVisitsForMember: (memberId: string) =>
    apiRequest<{ visits: VisitSummary[] }>(`/visits/member/${memberId}`),

  bulkAttendance: (input: BulkAttendanceInput) =>
    apiRequest<{ ingested: number; priorityScoresUpdated: number }>('/attendance/bulk', {
      method: 'POST',
      body: input,
    }),
};

// ---------------------------------------------------------------------
// Types mirroring the backend response shapes (see docs/API.md)
// ---------------------------------------------------------------------

export interface MemberSummary {
  id: string;
  full_name: string;
  membership_status: string;
  care_flags: string[];
  last_contacted_at: string | null;
  priority_score: number;
  assigned_pastor_id: string | null;
}

export interface MemberDetail {
  id: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  membershipStatus: string;
  careFlags: string[];
  lastContactedAt: string | null;
  priorityScore: number;
  dateOfBirth: string | null;
  joinedAt: string | null;
  assignedPastorId: string | null;
}

export interface CreateMemberInput {
  fullName: string;
  phone?: string;
  address?: string;
  membershipStatus?: 'active' | 'inactive' | 'visitor' | 'transferred' | 'deceased';
  careFlags?: string[];
  assignedPastorId?: string;
}

export interface LogVisitInput {
  memberId: string;
  interactionType: 'in_person' | 'phone_call' | 'video_call' | 'text_message' | 'other';
  notes?: string;
  occurredAt?: string;
  nextFollowUpDate?: string;
  clientGeneratedId: string;
}

export interface VisitSummary {
  id: string;
  interaction_type: string;
  occurred_at: string;
  next_follow_up_date: string | null;
  visited_by: string;
}

export interface BulkAttendanceInput {
  eventDate: string;
  eventType?: 'sunday_service' | 'midweek' | 'small_group' | 'special_event';
  records: { memberId: string; wasPresent: boolean }[];
}
