import React, { useState } from 'react';
import { api } from '../api/client';

/**
 * Bulk attendance import — pastes or uploads a simple CSV of
 * `memberId,wasPresent` rows for one event date and posts it to
 * POST /attendance/bulk, which triggers an immediate priority
 * recalculation server-side.
 */
export function AttendanceImportPage() {
  const [eventDate, setEventDate] = useState('');
  const [csvText, setCsvText] = useState('memberId,wasPresent\n');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parseCsv = (): { memberId: string; wasPresent: boolean }[] => {
    return csvText
      .trim()
      .split('\n')
      .slice(1) // skip header
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const [memberId, wasPresentRaw] = line.split(',').map((s) => s.trim());
        return { memberId, wasPresent: wasPresentRaw?.toLowerCase() === 'true' };
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const records = parseCsv();
    if (!eventDate || records.length === 0) {
      setError('Provide an event date and at least one attendance row.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.bulkAttendance({ eventDate, records });
      setResult(
        `Ingested ${res.ingested} records. Priority scores recalculated for ${res.priorityScoresUpdated} members.`
      );
    } catch {
      setError('Import failed. Check the CSV format and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <h1>Import Attendance</h1>
      <p className="subtitle">
        Paste rows as <code>memberId,wasPresent</code> (e.g. <code>uuid-here,true</code>). One row
        per member for a single event date.
      </p>

      <form className="visit-form" onSubmit={handleSubmit}>
        <label htmlFor="eventDate">Event date</label>
        <input
          id="eventDate"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          required
        />

        <label htmlFor="csv">Attendance CSV</label>
        <textarea
          id="csv"
          rows={12}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />

        {error && <div className="form-error">{error}</div>}
        {result && <div className="form-success">{result}</div>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Importing…' : 'Import attendance'}
        </button>
      </form>
    </div>
  );
}
