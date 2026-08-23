import { scoreMember, CareRuleWeights } from '../src/services/priorityEngine';

const weights: CareRuleWeights = {
  weightDaysSinceContact: 1,
  weightConsecutiveAbsences: 15,
  urgencyFlagBonus: 100,
  absenceLookbackEvents: 8,
};

describe('scoreMember', () => {
  it('scores a member with no contact history as maximally overdue', () => {
    const result = scoreMember(
      { memberId: 'm1', lastContactedAt: null, recentAttendance: [], careFlags: [] },
      weights
    );
    expect(result.daysSinceContact).toBe(9999);
    expect(result.priorityScore).toBeGreaterThan(9000);
  });

  it('counts only the leading streak of absences, not scattered misses', () => {
    const now = new Date('2026-08-21T00:00:00Z');
    const result = scoreMember(
      {
        memberId: 'm2',
        lastContactedAt: new Date('2026-08-01T00:00:00Z'),
        recentAttendance: [
          { wasPresent: false },
          { wasPresent: false },
          { wasPresent: true }, // streak stops here
          { wasPresent: false },
        ],
        careFlags: [],
        now,
      },
      weights
    );
    expect(result.consecutiveAbsences).toBe(2);
    expect(result.daysSinceContact).toBe(20);
    expect(result.priorityScore).toBe(20 * 1 + 2 * 15 + 0);
  });

  it('adds a flat bonus per active care flag', () => {
    const now = new Date('2026-08-21T00:00:00Z');
    const result = scoreMember(
      {
        memberId: 'm3',
        lastContactedAt: now,
        recentAttendance: [],
        careFlags: ['hospitalized', 'bereaved'],
        now,
      },
      weights
    );
    expect(result.urgencyBonus).toBe(200);
    expect(result.priorityScore).toBe(200);
  });

  it('caps the absence streak at absenceLookbackEvents', () => {
    const now = new Date('2026-08-21T00:00:00Z');
    const allAbsent = Array.from({ length: 20 }, () => ({ wasPresent: false }));
    const result = scoreMember(
      { memberId: 'm4', lastContactedAt: now, recentAttendance: allAbsent, careFlags: [], now },
      weights
    );
    expect(result.consecutiveAbsences).toBe(8);
  });
});
