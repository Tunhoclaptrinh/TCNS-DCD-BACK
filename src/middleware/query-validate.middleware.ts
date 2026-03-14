export const validateQuery = (req, res, next) => {
  const { _page, page, _limit, limit } = req.query;

  const pageNum = parseInt(_page || page);
  const limitNum = parseInt(_limit || limit);

  if (_page && (isNaN(pageNum) || pageNum < 1)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid page number. Must be a positive integer.',
    });
  }

  if (_limit && (isNaN(limitNum) || limitNum < 1 || limitNum > 100)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid limit. Must be between 1 and 100.',
    });
  }

  next();
};
