const SPECIAL_PARAMS = new Set([
  '_page',
  '_limit',
  '_sort',
  '_order',
  '_q',
  '_embed',
  '_expand',
  'page',
  'limit',
  'sort',
  'order',
  'q',
  'embed',
  'expand',
  'format',
  'columns',
  'includeRelations',
]);

const OPERATOR_SUFFIXES = ['_gte', '_lte', '_gt', '_lt', '_ne', '_like', '_in'];

function hasOperator(key) {
  return OPERATOR_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

function castValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !isNaN(value)) return Number(value);
  return value;
}

export const parseQuery = (req, res, next) => {
  const query = req.query;

  const page = Math.max(1, parseInt(query._page || query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(query._limit || query.limit) || 10), 100);
  const order = (query._order || query.order || 'asc').toLowerCase();

  const parsedQuery = {
    filter: {},
    page,
    limit,
    sort: query._sort || query.sort,
    order: order === 'desc' ? 'desc' : 'asc',
    q: query.q || query._q,
    embed: query._embed || query.embed,
    expand: query._expand || query.expand,
  };

  // Extract filter parameters
  for (const key of Object.keys(query)) {
    if (SPECIAL_PARAMS.has(key)) continue;

    if (hasOperator(key)) {
      parsedQuery.filter[key] = query[key];
    } else if (key === 'ids') {
      parsedQuery.filter['id_in'] = query[key];
    } else {
      parsedQuery.filter[key] = castValue(query[key]);
    }
  }

  if (Object.keys(parsedQuery.filter).length === 0) {
    parsedQuery.filter = null;
  }

  req.parsedQuery = parsedQuery;
  next();
};

export const formatResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    if (data && data.pagination) {
      const { page, limit, total, totalPages, hasPrev, hasNext } = data.pagination;

      res.set({
        'X-Total-Count': total,
        'X-Total-Pages': totalPages,
        'X-Current-Page': page,
        'X-Per-Page': limit,
        'Access-Control-Expose-Headers': 'X-Total-Count, X-Total-Pages, X-Current-Page, X-Per-Page, Link',
      });

      const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
      const buildLink = (pageNum) => {
        const params = new URLSearchParams(req.query);
        params.set('_page', pageNum);
        return `<${baseUrl}?${params.toString()}>`;
      };

      const links = [`${buildLink(1)}; rel="first"`];
      if (hasPrev) links.push(`${buildLink(page - 1)}; rel="prev"`);
      if (hasNext) links.push(`${buildLink(page + 1)}; rel="next"`);
      links.push(`${buildLink(totalPages)}; rel="last"`);

      res.set('Link', links.join(', '));
    }

    return originalJson(data);
  };

  next();
};

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

export const logQuery = (req, res, next) => {
  if (process.env.NODE_ENV === 'development' && Object.keys(req.query).length > 0) {
    console.log('📊 Query:', {
      path: req.path,
      query: req.query,
      parsed: req.parsedQuery,
    });
  }
  next();
};
