\getenv identity_password IDENTITY_DB_PASSWORD
\getenv customer_password CUSTOMER_DB_PASSWORD
\getenv driver_password DRIVER_DB_PASSWORD
\getenv booking_password BOOKING_DB_PASSWORD
\getenv trip_password TRIP_DB_PASSWORD
\getenv payment_password PAYMENT_DB_PASSWORD

CREATE ROLE identity LOGIN PASSWORD :'identity_password';
CREATE DATABASE identity_db OWNER identity;
CREATE ROLE customer LOGIN PASSWORD :'customer_password';
CREATE DATABASE customer_db OWNER customer;
CREATE ROLE driver LOGIN PASSWORD :'driver_password';
CREATE DATABASE driver_db OWNER driver;
CREATE ROLE booking LOGIN PASSWORD :'booking_password';
CREATE DATABASE booking_db OWNER booking;
CREATE ROLE trip LOGIN PASSWORD :'trip_password';
CREATE DATABASE trip_db OWNER trip;
CREATE ROLE payment LOGIN PASSWORD :'payment_password';
CREATE DATABASE payment_db OWNER payment;
