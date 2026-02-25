import { validationResult } from 'express-validator';

/**
 * Base Controller - Xử lý HTTP requests/responses
 * Các controller khác sẽ extend class này
 */
class BaseController {
  constructor(service) {
    this.service = service;
  }

  /**
   * GET all records
   */
  getAll = async (req, res, next) => {
    try {
      const result = await this.service.findAll(req.parsedQuery);

      res.json({
        success: result.success,
        count: result.data.length,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET one by ID
   */
  getById = async (req, res, next) => {
    try {
      const result = await this.service.findById(req.params.id);

      if (!result.success) {
        return res.status(result.statusCode || 404).json({
          success: false,
          message: result.message,
        });
      }

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST - Create new
   */
  create = async (req, res, next) => {
    try {
      const result = await this.service.create(req.body);

      if (!result.success) {
        return res.status(result.statusCode || 400).json({
          success: false,
          message: result.message,
        });
      }

      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT - Update
   */
  update = async (req, res, next) => {
    try {
      const result = await this.service.update(req.params.id, req.body);

      if (!result.success) {
        return res.status(result.statusCode || 400).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE
   */
  delete = async (req, res, next) => {
    try {
      const result = await this.service.delete(req.params.id);

      if (!result.success) {
        return res.status(result.statusCode || 400).json({
          success: false,
          message: result.message,
        });
      }

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET - Search
   */
  search = async (req, res, next) => {
    try {
      const { q } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required',
        });
      }

      const result = await this.service.search(q, req.parsedQuery);

      res.json({
        success: true,
        count: result.data.length,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  // ============= HELPERS =============

  validateRequest(req) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return errors.array();
    }
    return null;
  }
}

export default BaseController;
