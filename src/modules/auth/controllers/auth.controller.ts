import { validationResult } from 'express-validator';
import authService from '@modules/auth/services/auth.service';
import BaseController from '@shared/common/base-controller';
import ApiError from '@utils/api-error';

function ensureValidRequest(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest('Validation failed', errors.array());
  }
}

class AuthController extends BaseController {
  // Public register is disabled.

  login = this.handle(async (req, res) => {
    ensureValidRequest(req);
    const data = await authService.login(req.body);
    this.ok(res, data);
  });

  getMe = this.handle(async (req, res) => {
    this.ok(res, await authService.getMe(req.user));
  });

  logout = this.handle(async (_req, res) => {
    this.ok(res, authService.logout());
  });

  changePassword = this.handle(async (req, res) => {
    ensureValidRequest(req);
    const data = await authService.changePassword(req.user, req.body);
    this.ok(res, data);
  });

  refresh = this.handle(async (req, res) => {
    const data = await authService.refreshToken(req.body, req.headers.authorization);
    this.ok(res, data);
  });

  forgotPassword = this.handle(async (req, res) => {
    ensureValidRequest(req);
    const data = await authService.forgotPassword(req.body);
    this.ok(res, data);
  });

  resetPassword = this.handle(async (req, res) => {
    ensureValidRequest(req);
    const data = await authService.resetPassword(req.body);
    this.ok(res, data);
  });
}

export default new AuthController();
