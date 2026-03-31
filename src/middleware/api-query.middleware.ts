import { normalizeCommaList, normalizeKeyWithSuffix } from '@utils/case';
import { castQueryValue, hasQueryOperator, QUERY_OPERATOR_SUFFIXES, SPECIAL_QUERY_PARAMS } from '@utils/query-helpers';

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function buildPaginationLink(baseUrl: string, query: Record<string, any>, page: number) {
  const params = new URLSearchParams(query as Record<string, string>);
  params.set('_page', String(page));
  return `<${baseUrl}?${params.toString()}>`;
}

export const parseApiQuery = (req, _res, next) => {
  const query = req.query || {};
  const rawPage = query._page ?? query.page;
  const rawLimit = query._limit ?? query.limit;
  const parsedPage = parsePositiveInteger(rawPage, NaN);
  const parsedLimit = parsePositiveInteger(rawLimit, NaN);

  if (rawPage !== undefined && (Number.isNaN(parsedPage) || parsedPage < 1)) {
    return _res.status(400).json({
      success: false,
      message: 'Invalid page number. Must be a positive integer.',
    });
  }

  if (rawLimit !== undefined && (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100)) {
    return _res.status(400).json({
      success: false,
      message: 'Invalid limit. Must be between 1 and 100.',
    });
  }

  const page = Math.max(1, Number.isNaN(parsedPage) ? 1 : parsedPage);
  const limit = Math.min(Math.max(1, Number.isNaN(parsedLimit) ? 10 : parsedLimit), 100);
  const order = String(query._order || query.order || 'asc').toLowerCase();
  const sort = normalizeCommaList(query._sort || query.sort, (field) => normalizeKeyWithSuffix(field, []));
  const embed = normalizeCommaList(query._embed || query.embed, (field) => normalizeKeyWithSuffix(field, []));
  const expand = normalizeCommaList(query._expand || query.expand, (field) => normalizeKeyWithSuffix(field, []));
  const filter: Record<string, any> = {};

  for (const key of Object.keys(query)) {
    if (SPECIAL_QUERY_PARAMS.has(key)) {
      continue;
    }

    if (hasQueryOperator(key)) {
      filter[normalizeKeyWithSuffix(key, QUERY_OPERATOR_SUFFIXES)] = query[key];
      continue;
    }

    if (key === 'ids') {
      filter.id_in = query[key];
      continue;
    }

    filter[normalizeKeyWithSuffix(key, QUERY_OPERATOR_SUFFIXES)] = castQueryValue(query[key]);
  }

  req.parsedQuery = {
    filter: Object.keys(filter).length === 0 ? null : filter,
    page,
    limit,
    sort: typeof sort === 'string' ? sort : undefined,
    order: order === 'desc' ? 'desc' : 'asc',
    q: query.q || query._q,
    embed,
    expand,
  };

  next();
};

export const appendPaginationHeaders = (req, res, next) => {
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
      const links = [buildPaginationLink(baseUrl, req.query, 1) + '; rel="first"'];

      if (hasPrev) {
        links.push(buildPaginationLink(baseUrl, req.query, page - 1) + '; rel="prev"');
      }

      if (hasNext) {
        links.push(buildPaginationLink(baseUrl, req.query, page + 1) + '; rel="next"');
      }

      links.push(buildPaginationLink(baseUrl, req.query, totalPages) + '; rel="last"');
      res.set('Link', links.join(', '));
    }

    return originalJson(data);
  };

  next();
};
