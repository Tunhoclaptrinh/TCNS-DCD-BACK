import express from 'express';
import meetingController from '@modules/meetings/controllers/meeting.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

router.use(requireAuth);

router.get('/', requirePermission('duty:view'), meetingController.getMeetings);
router.get('/:id', requirePermission('duty:view'), meetingController.getMeetingById);

router.post('/', requirePermission('duty:manage'), meetingController.createMeeting);
router.put('/:id', requirePermission('duty:manage'), meetingController.updateMeeting);
router.delete('/:id', requirePermission('duty:manage'), meetingController.deleteMeeting);

router.post('/:id/rsvp', meetingController.rsvpMeeting);
router.post('/attendance', requirePermission('duty:manage'), meetingController.markAttendance);

export default router;
