// Method names match cab.proto. Each method has an explicit caller allowlist.
module.exports = {
  'payment-service': { name: null, port: 50055, methods: {} },
  'notification-service': { name: null, port: 50056, methods: {} },
  'identity-service': {
    name: 'IdentityService', port: 50050,
    methods: {
      CreateAccount: { callers: ['driver-service'], handler: 'postInternalAccounts' },
      ActivateAccount: { callers: ['driver-service'], handler: 'postInternalAccountsIdActivate', params: ['id'] },
      DeleteAccount: { callers: ['driver-service'], handler: 'deleteInternalAccountsId', params: ['id'] },
    },
  },
  'customer-service': {
    name: 'CustomerService', port: 50051,
    methods: { CreateCustomer: { callers: ['identity-service'], handler: 'createCustomer', controller: true } },
  },
  'driver-service': {
    name: 'DriverService', port: 50052,
    methods: {
      FindNearby: { callers: ['booking-service'], handler: 'getInternalDriversNearby', query: true },
      ReserveDriver: { callers: ['booking-service'], handler: 'postInternalDriversIdReservations', params: ['id'] },
      ReleaseReservation: { callers: ['booking-service'], handler: 'deleteInternalDriversIdReservationsBookingid', params: ['id', 'bookingId'] },
      SetBusy: { callers: ['booking-service'], handler: 'postInternalDriversIdBusy', params: ['id'] },
      SetAvailable: { callers: ['trip-service'], handler: 'postInternalDriversIdAvailable', params: ['id'] },
      GetSummary: { callers: ['trip-service'], handler: 'getInternalDriversIdSummary', params: ['id'] },
    },
  },
  'trip-service': {
    name: 'TripService', port: 50054,
    methods: {
      CreateTrip: { callers: ['booking-service'], handler: 'postInternalTrips' },
      GetTrip: { callers: ['payment-service'], handler: 'getInternalTripsId', params: ['id'] },
      CancelTrip: { callers: ['booking-service'], handler: 'postTripsIdCancel', params: ['id'], user: true },
      UpdatePaymentStatus: { callers: ['payment-service', 'booking-service'], handler: 'postInternalTripsIdPaymentStatus', params: ['id'] },
    },
  },
  'booking-service': {
    name: 'BookingService', port: 50053,
    methods: {
      UpdateTripStatus: { callers: ['trip-service'], handler: 'postInternalBookingsIdTripStatus', params: ['id'] },
      UpdatePaymentStatus: { callers: ['payment-service'], handler: 'postInternalBookingsIdPaymentStatus', params: ['id'] },
    },
  },
};
