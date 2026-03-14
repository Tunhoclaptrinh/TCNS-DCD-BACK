import { normalizeCommaList, normalizeKeyWithSuffix } from '@utils/case';
import { castQueryValue, hasQueryOperator, QUERY_OPERATOR_SUFFIXES, SPECIAL_QUERY_PARAMS } from '@utils/query-helpers';

export const parseQuery = (req, _res, next) => {
  const query = req.query;
  const page = Math.max(1, parseInt(query._page || query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(query._limit || query.limit) || 10), 100);
  const order = (query._order || query.order || 'asc').toLowerCase();
  const sort = normalizeCommaList(query._sort || query.sort, (field) => normalizeKeyWithSuffix(field, []));
  const embed = normalizeCommaList(query._embed || query.embed, (field) => normalizeKeyWithSuffix(field, []));
  const expand = normalizeCommaList(query._expand || query.expand, (field) => normalizeKeyWithSuffix(field, []));
  const filter: Record<string, any> = {};

  for (const key of Object.keys(query)) {
    if (SPECIAL_QUERY_PARAMS.has(key)) continue;

    if (hasQueryOperator(key)) {
      filter[normalizeKeyWithSuffix(key, QUERY_OPERATOR_SUFFIXES)] = query[key];
    } else if (key === 'ids') {
      // Giữ nguyên alias `ids` -> `id_in` để không đổi query semantics hiện tại.
      filter.id_in = query[key];
    } else {
      filter[normalizeKeyWithSuffix(key, QUERY_OPERATOR_SUFFIXES)] = castQueryValue(query[key]);
    }
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
