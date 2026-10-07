const service = require("../services/payment.handlers");

async function postPayments(req, res) {
  const result = await service.postPayments({
    headers: req.headers,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user,
    requestId: req.requestId,
    rawBody: req.rawBody
  });
  return res.status(result.status).json(result.body);
}

async function postPaymentsCallback(req, res) {
  const result = await service.postPaymentsCallback({
    headers: req.headers,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user,
    requestId: req.requestId,
    rawBody: req.rawBody
  });
  return res.status(result.status).json(result.body);
}

async function postPaymentsTrip(req, res) {
  const result = await service.postPaymentsTrip({
    headers: req.headers, params: req.params, user: req.user, requestId: req.requestId
  });
  return res.status(result.status).json(result.body);
}

async function getPaymentsId(req, res) {
  const result = await service.getPaymentsId({
    headers: req.headers,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user,
    requestId: req.requestId,
    rawBody: req.rawBody
  });
  return res.status(result.status).json(result.body);
}

module.exports = { postPayments, postPaymentsTrip, postPaymentsCallback, getPaymentsId };
