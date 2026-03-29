import { validationResult } from 'express-validator';
import authService from '@modules/auth/services/auth.service';
import ApiError from '@utils/api-error';

function ensureValidRequest(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest('Validation failed', errors.array());
  }
}

class AuthController {
  register = async (req, res, next) => {
    try {
      ensureValidRequest(req);
      const data = await authService.register(req.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  login = async (req, res, next) => {
    try {
      ensureValidRequest(req);
      const data = await authService.login(req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  getMe = async (req, res, next) => {
    try {
      res.json(authService.getMe(req.user));
    } catch (error) {
      next(error);
    }
  };

  logout = async (_req, res, next) => {
    try {
      res.json(authService.logout());
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req, res, next) => {
    try {
      ensureValidRequest(req);
      const data = await authService.changePassword(req.user, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req, res, next) => {
    try {
      const data = await authService.refreshToken(req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req, res, next) => {
    try {
      ensureValidRequest(req);
      const data = await authService.forgotPassword(req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req, res, next) => {
    try {
      ensureValidRequest(req);
      const data = await authService.resetPassword(req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };
}

export default new AuthController();
