export const baseDutyRequestFields = {
  reason: {
    type: 'string' as const,
    required: true,
    maxLength: 500,
    description: 'Lý do gửi yêu cầu',
  },
  status: {
    type: 'enum' as const,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    required: false,
    default: 'pending',
    description: 'Trạng thái phê duyệt',
  },
  approvedBy: {
    type: 'number' as const,
    required: false,
    foreignKey: 'users',
    description: 'Người phê duyệt',
  },
};
