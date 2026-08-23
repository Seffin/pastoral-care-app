import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, MemberDetail, VisitSummary } from '../api/client';

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [visits, setVisits] = useState<VisitSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getMember(id), api.listVisitsForMember(id)])
      .then(([memberRes, visitsRes]) => {
        setMember(memberRes);
        setVisits(visitsRes.visits);
      })
      .catch(() => setError('Could not load this member.'));
  }, [id]);

  if (error) return <div className="page">{error}</div>;
  if (!member) return <div className="page">Loading…</div>;

  return (
    <div className="page">
      <Link to="/dashboard">← Back to dashboard</Link>
      <header className="page-header">
        <h1>{member.fullName}</h1>
        <Link to={`/members/${member.id}/visit`}>Log a visit</Link>
      </header>

      <section className="detail-grid">
        <div>
          <strong>Status</strong>
          <p>{member.membershipStatus}</p>
        </div>
        <div>
          <strong>Priority score</strong>
          <p>{Math.round(member.priorityScore)}</p>
        </div>
        <div>
          <strong>Phone</strong>
          <p>{member.phone ?? '—'}</p>
        </div>
        <div>
          <strong>Address</strong>
          <p>{member.address ?? '—'}</p>
        </div>
        <div>
          <strong>Last contacted</strong>
          <p>{member.lastContactedAt ? new Date(member.lastContactedAt).toLocaleDateString() : 'Never'}</p>
        </div>
      </section>

      <h2>Visit history</h2>
      {visits.length === 0 ? (
        <p>No visits logged yet.</p>
      ) : (
        <ul className="visit-list">
          {visits.map((visit) => (
            <li key={visit.id}>
              <strong>{visit.interaction_type.replace('_', ' ')}</strong> —{' '}
              {new Date(visit.occurred_at).toLocaleString()}
              {visit.next_follow_up_date && (
                <span> · follow up by {new Date(visit.next_follow_up_date).toLocaleDateString()}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
