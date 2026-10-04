const service = require("../services/identity.handlers");

async function postAuthRegister(req, res) {
  const result = await service.postAuthRegister({
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

async function postAuthLogin(req, res) {
  const result = await service.postAuthLogin({
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

async function getAdminMe(req, res) {
  const result = await service.getAdminMe({ user: req.user, requestId: req.requestId });
  return res.status(result.status).json(result.body);
}

async function postInternalAccounts(req, res) {
  const result = await service.postInternalAccounts({
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

async function postInternalAccountsIdActivate(req, res) {
  const result = await service.postInternalAccountsIdActivate({ params: req.params, requestId: req.requestId });
  return res.status(result.status).json(result.body);
}

async function deleteInternalAccountsId(req, res) {
  const result = await service.deleteInternalAccountsId({ params: req.params, requestId: req.requestId });
  return res.status(result.status).json(result.body);
}

async function getInternalRolesRolePermissions(req, res) {
  const result = await service.getInternalRolesRolePermissions({
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

module.exports = { postAuthRegister, postAuthLogin, getAdminMe, postInternalAccounts, postInternalAccountsIdActivate, deleteInternalAccountsId, getInternalRolesRolePermissions };
