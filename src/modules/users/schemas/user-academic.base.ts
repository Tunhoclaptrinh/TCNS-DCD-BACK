export const userAcademicFields = {
  studentId: {
    type: 'string' as const,
    required: false,
    label: 'Mã sinh viên',
  },
  classId: {
    type: 'string' as const,
    required: false,
    label: 'Lớp',
  },
  position: {
    type: 'enum' as const,
    enum: ['ctv', 'tv', 'tvb', 'pb', 'tb', 'dt'],
    required: false,
    label: 'Chức vụ',
  },
  department: {
    type: 'string' as const,
    required: false,
    label: 'Phòng ban/Ban',
  },
  generationId: {
    type: 'number' as const,
    required: true,
    foreignKey: 'generations',
    label: 'ID Khóa/Thế hệ',
  },
};
