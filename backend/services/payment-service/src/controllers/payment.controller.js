const service = require('../services/payment.handlers');

async function postPaymentsTrip(req, res) {
  const result = await service.postPaymentsTrip({
    headers: req.headers, params: req.params, user: req.user, requestId: req.requestId
  });
  return res.status(result.status).json(result.body);
}

async function getPaymentsId(req, res) {
  const result = await service.getPaymentsId({
    params: req.params, user: req.user, requestId: req.requestId
  });
  return res.status(result.status).json(result.body);
}

module.exports = { postPaymentsTrip, getPaymentsId };
