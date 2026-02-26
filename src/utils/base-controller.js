class BaseController {
  constructor(service) {
    this.service = service;
  }

  getAll = async (req, res, next) => {
    try {
      const result = await this.service.findAll(req.parsedQuery);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.service.findById(req.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const data = await this.service.create(req.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const data = await this.service.update(req.params.id, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      const result = await this.service.delete(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  search = async (req, res, next) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ message: 'Search query is required' });
      }
      const result = await this.service.search(q, req.parsedQuery);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}

export default BaseController;
