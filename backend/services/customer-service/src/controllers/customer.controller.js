const customerService = require("../services/customer.service");
const { errorResponse } = require("../utils/errorResponse");
const { parsePagination } = require("../../../../shared/src/pagination");

async function listCustomers(req, res) {
  const requestId = req.requestId;
  if (req.user.role !== "ADMIN") {
    return errorResponse(res, 403, "FORBIDDEN", "Admin access required", requestId);
  }

  const pagination = parsePagination(req.query);
  if (!pagination) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "Invalid page or limit (limit must be 1-100)", requestId);
  }

  try {
    return res.json(await customerService.listCustomers(pagination));
  } catch (err) {
    console.error("[customer/list]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to list customers", requestId);
  }
}

async function getCustomer(req, res) {
  const { id } = req.params;
  const requestId = req.requestId;

  try {
    const customer = await customerService.getCustomerById(id, req.user);
    return res.json(customer);
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.code, err.message, requestId);
    console.error("[customer/get]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to get customer", requestId);
  }
}

async function getCustomerMe(req, res) {
  if (req.user.role !== "CUSTOMER") {
    return errorResponse(res, 403, "FORBIDDEN", "Customer access required", req.requestId);
  }
  try {
    return res.json(await customerService.getCustomerById(req.user.sub, req.user));
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.code, err.message, req.requestId);
    console.error("[customer/me]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to get customer", req.requestId);
  }
}

async function createCustomer(req, res) {
  const requestId = req.requestId;
  const { id, fullName, email, phone, phoneHash } = req.body;
  if (!id || !fullName || !email || !phoneHash) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "id, fullName, email, phoneHash required", requestId);
  }

  try {
    const customer = await customerService.createCustomerProfile({ id, fullName, email, phone, phoneHash });
    return res.status(201).json(customer);
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.code, err.message, requestId);
    console.error("[customer/internal/create]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to create customer", requestId);
  }
}

module.exports = { getCustomer, getCustomerMe, listCustomers, createCustomer };
