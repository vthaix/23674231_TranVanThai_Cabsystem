function parsePagination(query) {
  if ((query.page !== undefined && !/^[1-9]\d*$/.test(query.page)) ||
      (query.limit !== undefined && !/^[1-9]\d*$/.test(query.limit))) {
    return null;
  }
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);

  if (!Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger((page - 1) * limit)) {
    return null;
  }

  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { parsePagination };
