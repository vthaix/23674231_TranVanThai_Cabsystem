function errorResponse(res, status, code, message, requestId) {
  return res.status(status).json({ code, message, requestId });
}

module.exports = { errorResponse };
