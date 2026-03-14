export const logQuery = (req, _res, next) => {
  if (process.env.NODE_ENV === 'development' && Object.keys(req.query).length > 0) {
    console.log('📊 Query:', {
      path: req.path,
      query: req.query,
      parsed: req.parsedQuery,
    });
  }

  next();
};
