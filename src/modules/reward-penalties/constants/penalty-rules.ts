export const PENALTY_RULES = {
  ABSENT_WITHOUT_LEAVE: {
    type: 'penalty',
    amount: 50000,
    reason: 'Vắng trực không phép',
  },
  ABSENT_WITH_LEAVE_LATE: {
    type: 'penalty',
    amount: 20000,
    reason: 'Vắng trực có phép (báo muộn sau 22h)',
  },
  LATE_ARRIVAL: {
    type: 'penalty',
    amount: 10000,
    reason: 'Đi trực muộn',
  },
  MEETING_ABSENT_WITHOUT_LEAVE: {
    type: 'penalty',
    amount: 50000,
    reason: 'Vắng họp không phép',
  },
  MEETING_ABSENT_WITH_LEAVE: {
    type: 'penalty',
    amount: 20000,
    reason: 'Vắng họp có phép',
  },
};

export type PenaltyRuleKey = keyof typeof PENALTY_RULES;
