const { decrypt, encrypt, hashPhone } = require("../../../../shared/src/crypto/index");
const customerRepository = require("../repositories/customer.repository");
const { maskPhone } = require("../utils/maskPhone");

const allowedRoles = ["EMPLOYEE", "OPERATIONS_STAFF", "USER_STAFF", "SUPERVISOR", "FINANCE_STAFF", "ADMIN", "BOARD"];

async function getCustomerById(id, user) {
  const { sub: userId, role } = user;
  if ((role === "CUSTOMER" && userId !== id) || (!allowedRoles.includes(role) && role !== "CUSTOMER")) {
    throw Object.assign(new Error("Access denied"), { status: 403, code: "FORBIDDEN" });
  }

  const customer = await customerRepository.findById(id);
  if (!customer) {
    throw Object.assign(new Error("Customer not found"), { status: 404, code: "NOT_FOUND" });
  }

  let phone = null;
  if (customer.phone_enc) {
    try {
      const decrypted = decrypt(customer.phone_enc);
      phone = (role === "CUSTOMER" && userId === id) ? decrypted : maskPhone(decrypted);
    } catch {
      phone = null;
    }
  }

  return {
    id: customer.id,
    fullName: customer.full_name,
    email: customer.email,
    phone,
    dateOfBirth: customer.date_of_birth,
    gender: customer.gender,
    avatarUrl: customer.avatar_url,
    status: customer.status,
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  };
}

async function createCustomerProfile(data) {
  const { id } = data;
  if (await customerRepository.existsById(id)) return { id };

  if (data.phone && hashPhone(data.phone) !== data.phoneHash) {
    throw Object.assign(new Error("Phone hash does not match phone"), { status: 400, code: "VALIDATION_ERROR" });
  }

  try {
    await customerRepository.createCustomer({
      ...data,
      phoneEnc: data.phone ? encrypt(data.phone) : null,
      email: data.email.toLowerCase()
    });
  } catch (err) {
    if (err.code !== "23505") throw err;
  }

  return { id };
}

async function listCustomers({ page, limit, offset }) {
  const [customers, total] = await Promise.all([
    customerRepository.listCustomers({ limit, offset }),
    customerRepository.countCustomers()
  ]);

  return {
    data: customers.map(customer => ({
      id: customer.id,
      fullName: customer.full_name,
      email: customer.email,
      status: customer.status,
      createdAt: customer.created_at
    })),
    pagination: { page, limit, total }
  };
}

module.exports = { getCustomerById, createCustomerProfile, listCustomers };
