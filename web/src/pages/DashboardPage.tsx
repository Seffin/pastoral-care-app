import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, MemberSummary } from '../api/client';
import { useAuth } from '../context/AuthContext';

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

interface Badge {
  label: string;
  tone: 'critical' | 'warning' | 'info';
}

function deriveBadges(member: MemberSummary): Badge[] {
  const badges: Badge[] = [];
  if (member.care_flags.includes('hospitalized')) badges.push({ label: 'Hospitalized', tone: 'critical' });
  if (member.care_flags.includes('bereaved')) badges.push({ label: 'Bereaved', tone: 'critical' });

  const days = daysSince(member.last_contacted_at);
  if (days === null || days >= 30) badges.push({ label: 'Overdue', tone: 'warning' });

  if (badges.length === 0) badges.push({ label: 'On Track', tone: 'info' });
  return badges;
}

export function DashboardPage() {
  const { logout } = useAuth();
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listMembers({ limit: 100, status: 'active' })
      .then((res) => {
        if (!cancelled) setMembers(res.members);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load members. Please refresh.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <h1>Pastoral Dashboard</h1>
        <div className="header-actions">
          <Link to="/attendance/import">Import attendance</Link>
          <button className="link-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {loading && <p>Loading members…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <table className="member-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Status</th>
              <th>Priority</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <Link to={`/members/${member.id}`}>{member.full_name}</Link>
                </td>
                <td>
                  <div className="badge-row">
                    {deriveBadges(member).map((badge) => (
                      <span key={badge.label} className={`badge badge-${badge.tone}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="score-cell">{Math.round(member.priority_score)}</td>
                <td>
                  <Link to={`/members/${member.id}/visit`} className="log-visit-link">
                    Log visit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && members.length === 0 && <p>No active members found.</p>}
    </div>
  );
}
