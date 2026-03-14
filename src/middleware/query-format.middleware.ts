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
