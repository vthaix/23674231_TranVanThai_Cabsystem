const service = require("../services/booking.handlers");

async function postInternalTestKafka(req, res) {
  const result = await service.postInternalTestKafka({
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

async function getBookings(req, res) {
  const result = await service.getBookings({
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

async function postBookings(req, res) {
  const result = await service.postBookings({
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

async function getOffers(req, res) {
  const result = await service.getOffers({
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

async function postOffersIdAccept(req, res) {
  const result = await service.postOffersIdAccept({
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

async function postOffersIdReject(req, res) {
  const result = await service.postOffersIdReject({
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

async function postBookingsIdCancel(req, res) {
  const result = await service.postBookingsIdCancel({
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

module.exports = { postInternalTestKafka, getBookings, postBookings, getOffers, postOffersIdAccept, postOffersIdReject, postBookingsIdCancel };
