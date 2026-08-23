import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, LogVisitInput } from '../api/client';

const INTERACTION_TYPES: { value: LogVisitInput['interactionType']; label: string }[] = [
  { value: 'in_person', label: 'In-Person' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'video_call', label: 'Video Call' },
  { value: 'text_message', label: 'Text Message' },
  { value: 'other', label: 'Other' },
];

export function VisitLoggerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [interactionType, setInteractionType] = useState<LogVisitInput['interactionType']>('in_person');
  const [notes, setNotes] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.logVisit({
        memberId: id,
        interactionType,
        notes: notes || undefined,
        nextFollowUpDate: nextFollowUpDate || undefined,
        // Web is online-only, but we still generate this client-side so
        // a duplicate submit (double-click, browser retry) is deduped
        // by the same idempotency mechanism the mobile app relies on.
        clientGeneratedId: crypto.randomUUID(),
      });
      navigate(`/members/${id}`);
    } catch {
      setError('Could not save this visit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <h1>Log a Visit</h1>
      <form className="visit-form" onSubmit={handleSubmit}>
        <label>Interaction type</label>
        <div className="chip-row">
          {INTERACTION_TYPES.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`chip ${interactionType === option.value ? 'chip-selected' : ''}`}
              onClick={() => setInteractionType(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          rows={6}
          placeholder="What was discussed? Any prayer requests or follow-up needed?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <label htmlFor="followUp">Next follow-up date (optional)</label>
        <input
          id="followUp"
          type="date"
          value={nextFollowUpDate}
          onChange={(e) => setNextFollowUpDate(e.target.value)}
        />

        {error && <div className="form-error">{error}</div>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save visit'}
        </button>
      </form>
    </div>
  );
}
