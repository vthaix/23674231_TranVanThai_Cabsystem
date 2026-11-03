-- System roles must exist before registration can assign CUSTOMER.
INSERT INTO roles (code, name) VALUES
  ('CUSTOMER', 'Customer'),
  ('DRIVER', 'Driver'),
  ('OPERATIONS_STAFF', 'Operations Staff'),
  ('USER_STAFF', 'User Staff'),
  ('FINANCE_STAFF', 'Finance Staff'),
  ('SUPERVISOR', 'Supervisor'),
  ('ADMIN', 'Administrator'),
  ('BOARD', 'Board of Directors')
ON CONFLICT (code) DO NOTHING;
