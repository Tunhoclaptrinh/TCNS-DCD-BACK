import type { NextFunction, Request, Response } from 'express';
import { normalizeKeyWithSuffix } from '@utils/case';
import { castQueryValue, hasQueryOperator, QUERY_OPERATOR_SUFFIXES, SPECIAL_QUERY_PARAMS } from '@utils/query-helpers';

type QueryParams = Record<string, any>;
type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

function parseIntegerQueryParam(value: unknown) {
  const parsedNumber = Number.parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsedNumber) ? null : parsedNumber;
}

function sendInvalidPaginationResponse(res: Response, message: string) {
  return res.status(400).json({
    success: false,
    message,
  });
}

function buildPaginationLink(baseUrl: string, query: QueryParams, targetPage: number) {
  const searchParams = new URLSearchParams(query as Record<string, string>);
  searchParams.set('_page', String(targetPage));
  return `<${baseUrl}?${searchParams.toString()}>`;
}

function buildFilterFromQuery(query: QueryParams) {
  const filter: QueryParams = {};

  for (const [rawKey, rawValue] of Object.entries(query)) {
    if (SPECIAL_QUERY_PARAMS.has(rawKey)) {
      continue;
    }

    if (hasQueryOperator(rawKey)) {
      filter[normalizeKeyWithSuffix(rawKey, QUERY_OPERATOR_SUFFIXES)] = rawValue;
      continue;
    }

    if (rawKey === 'ids') {
      filter.id_in = rawValue;
      continue;
    }

    filter[normalizeKeyWithSuffix(rawKey, QUERY_OPERATOR_SUFFIXES)] = castQueryValue(rawValue);
  }

  return Object.keys(filter).length === 0 ? null : filter;
}

function normalizeListQueryValue(queryValue: unknown) {
  if (!queryValue) {
    return undefined;
  }

  return String(queryValue)
    .split(',')
    .map((item) => normalizeKeyWithSuffix(item.trim(), []))
    .filter(Boolean)
    .join(',');
}

function setPaginationResponseHeaders(
  req: Request,
  res: Response,
  pagination: PaginationMeta,
  requestQuery: QueryParams,
) {
  const { page, limit, total, totalPages, hasPrev, hasNext } = pagination;

  res.set({
    'X-Total-Count': total,
    'X-Total-Pages': totalPages,
    'X-Current-Page': page,
    'X-Per-Page': limit,
    'Access-Control-Expose-Headers': 'X-Total-Count, X-Total-Pages, X-Current-Page, X-Per-Page, Link',
  });

  const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
  const paginationLinks = [buildPaginationLink(baseUrl, requestQuery, 1) + '; rel="first"'];

  if (hasPrev) {
    paginationLinks.push(buildPaginationLink(baseUrl, requestQuery, page - 1) + '; rel="prev"');
  }

  if (hasNext) {
    paginationLinks.push(buildPaginationLink(baseUrl, requestQuery, page + 1) + '; rel="next"');
  }

  paginationLinks.push(buildPaginationLink(baseUrl, requestQuery, totalPages) + '; rel="last"');
  res.set('Link', paginationLinks.join(', '));
}

// Chuẩn hóa query filter/sort/paging từ URL rồi gắn vào `req.parsedQuery`.
export const parseApiQuery = (req: Request, res: Response, next: NextFunction) => {
  const query = req.query as QueryParams;
  const rawPage = query._page ?? query.page;
  const rawLimit = query._limit ?? query.limit;
  const parsedPage = parseIntegerQueryParam(rawPage);
  const parsedLimit = parseIntegerQueryParam(rawLimit);

  if (rawPage !== undefined && (!parsedPage || parsedPage < 1)) {
    return sendInvalidPaginationResponse(res, 'Invalid page number. Must be a positive integer.');
  }

  if (rawLimit !== undefined && parsedLimit !== -1 && (!parsedLimit || parsedLimit < 1 || parsedLimit > 10000)) {
    return sendInvalidPaginationResponse(res, 'Invalid limit. Must be between 1 and 10000, or -1 for all.');
  }

  req.parsedQuery = {
    filter: buildFilterFromQuery(query),
    page: parsedPage ?? 1,
    limit: parsedLimit ?? 10,
    sort: normalizeListQueryValue(query._sort || query.sort),
    order: String(query._order || query.order || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc',
    q: query.q || query._q,
    embed: normalizeListQueryValue(query._embed || query.embed),
    expand: normalizeListQueryValue(query._expand || query.expand),
  };

  next();
};

// Tự động thêm header phân trang nếu response có `pagination`.
export const appendPaginationHeaders = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = function jsonWithPaginationHeaders(responseBody: any) {
    if (responseBody?.pagination) {
      setPaginationResponseHeaders(req, res, responseBody.pagination, req.query as QueryParams);
    }

    return originalJson(responseBody);
  };

  next();
};
