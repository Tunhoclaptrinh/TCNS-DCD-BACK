import express from 'express';
import meetingController from '@modules/meetings/controllers/meeting.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

router.use(requireAuth);

// Xem lịch họp - cần meeting:view
router.get('/stats', requirePermission('meeting:view'), meetingController.getMeetingStats);
router.get('/', requirePermission('meeting:view'), meetingController.getMeetings);
router.get('/:id', requirePermission('meeting:view'), meetingController.getMeetingById);

// Tạo/sửa/xóa - cần meeting:create:all hoặc meeting:create:dept (alias 'meeting:create')
router.post('/', requirePermission('meeting:create'), meetingController.createMeeting);
router.put('/:id', requirePermission('meeting:create'), meetingController.updateMeeting);
router.delete('/:id', requirePermission('meeting:create:all'), meetingController.deleteMeeting);

// RSVP - bất kỳ user đã auth
router.post('/:id/rsvp', meetingController.rsvpMeeting);

// Điểm danh - cần meeting:attendance
router.post('/attendance', requirePermission('meeting:attendance'), meetingController.markAttendance);

export default router;
