const customerService = require("../services/customer.service");
const { errorResponse } = require("../utils/errorResponse");

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

async function createCustomer(req, res) {
  const requestId = req.requestId;
  const { id, fullName, email, phoneHash } = req.body;
  if (!id || !fullName || !email || !phoneHash) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "id, fullName, email, phoneHash required", requestId);
  }

  try {
    const customer = await customerService.createCustomerProfile({ id, fullName, email, phoneHash });
    return res.status(201).json(customer);
  } catch (err) {
    console.error("[customer/internal/create]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to create customer", requestId);
  }
}

module.exports = { getCustomer, createCustomer };
