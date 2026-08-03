import meetingService from '@modules/meetings/services/meeting.service';
import BaseController from '@shared/common/base-controller';

class MeetingController extends BaseController {
  getMeetings = this.handle(async (req, res) => {
    const data = await meetingService.listMeetings(req.user, req.parsedQuery);
    this.ok(res, data);
  });

  getMeetingById = this.handle(async (req, res) => {
    const data = await meetingService.getMeetingById(req.params.id, req.user);
    this.ok(res, data);
  });

  getMeetingStats = this.handle(async (req, res) => {
    const data = await meetingService.getMeetingStats(req.user, req.parsedQuery);
    this.ok(res, data);
  });

  createMeeting = this.handle(async (req, res) => {
    const data = await meetingService.createMeeting(req.body, req.user.id);
    this.created(res, data);
  });

  updateMeeting = this.handle(async (req, res) => {
    const data = await meetingService.updateMeeting(req.params.id, req.body, req.user.id);
    this.ok(res, data);
  });

  deleteMeeting = this.handle(async (req, res) => {
    const data = await meetingService.deleteMeeting(req.params.id, req.user.id);
    this.ok(res, data);
  });

  rsvpMeeting = this.handle(async (req, res) => {
    const data = await meetingService.rsvpMeeting(req.params.id, req.body, req.user);
    this.ok(res, data);
  });

  markAttendance = this.handle(async (req, res) => {
    const data = await meetingService.markAttendance(req.body, req.user);
    this.ok(res, data);
  });
}

export default new MeetingController();
