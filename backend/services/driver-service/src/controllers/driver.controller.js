const service = require("../services/driver.handlers");

async function postDriversOtpRequest(req, res) {
  const result = await service.postDriversOtpRequest({
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

async function postDriversOtpVerify(req, res) {
  const result = await service.postDriversOtpVerify({
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

async function postDriversRegister(req, res) {
  const result = await service.postDriversRegister({
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

async function getAdminDrivers(req, res) {
  const result = await service.getAdminDrivers({
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

async function getAdminDriversId(req, res) {
  const result = await service.getAdminDriversId({
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

async function postAdminDriversIdApprove(req, res) {
  const result = await service.postAdminDriversIdApprove({
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

async function postAdminDriversIdReject(req, res) {
  const result = await service.postAdminDriversIdReject({
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

async function putDriversMeAvailability(req, res) {
  const result = await service.putDriversMeAvailability({
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

async function putDriversMeLocation(req, res) {
  const result = await service.putDriversMeLocation({
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

async function getDriversNearby(req, res) {
  const result = await service.getDriversNearby({
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

async function getDriversId(req, res) {
  const result = await service.getDriversId({
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

async function getInternalDriversNearby(req, res) {
  const result = await service.getInternalDriversNearby({
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

async function postInternalDriversIdReservations(req, res) {
  const result = await service.postInternalDriversIdReservations({
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

async function deleteInternalDriversIdReservationsBookingid(req, res) {
  const result = await service.deleteInternalDriversIdReservationsBookingid({
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

async function postInternalDriversIdBusy(req, res) {
  const result = await service.postInternalDriversIdBusy({
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

async function getInternalDriversIdSummary(req, res) {
  const result = await service.getInternalDriversIdSummary({
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

module.exports = { postDriversOtpRequest, postDriversOtpVerify, postDriversRegister, getAdminDrivers, getAdminDriversId, postAdminDriversIdApprove, postAdminDriversIdReject, putDriversMeAvailability, putDriversMeLocation, getDriversNearby, getDriversId, getInternalDriversNearby, postInternalDriversIdReservations, deleteInternalDriversIdReservationsBookingid, postInternalDriversIdBusy, getInternalDriversIdSummary };
