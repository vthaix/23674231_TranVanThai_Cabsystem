const service = require("../services/booking.handlers");

async function postInternalBookingsIdTripStatus(req, res) {
  const result = await service.postInternalBookingsIdTripStatus({
    headers: req.headers, body: req.body, params: req.params, requestId: req.headers['x-request-id']
  });
  return res.status(result.status).json(result.body);
}

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

async function getBookingsId(req, res) {
  const result = await service.getBookingsId({
    headers: req.headers, body: req.body, params: req.params,
    query: req.query, user: req.user, requestId: req.requestId
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

async function postBookingsIdAccept(req, res) {
  const result = await service.postBookingsIdAccept({
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

module.exports = { postInternalTestKafka, postInternalBookingsIdTripStatus, getBookings, getBookingsId, postBookings, getOffers, postBookingsIdAccept, postOffersIdAccept, postOffersIdReject, postBookingsIdCancel };
