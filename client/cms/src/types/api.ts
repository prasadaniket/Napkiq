export interface ApiError {
  status: number
  message: string
  timestamp: string
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
}

export interface LoginResponse {
  token: string
  refreshToken?: string
  userId: string
  username: string | null
  fullName: string
  email: string
  role: 'admin' | 'owner' | 'franchise_owner'
  assignedOutletId: string | null
  assignedOutletName: string | null
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalCustomers:        number
  totalReviews:          number
  totalVisits:           number
  averageRating:         number | null
  inactiveCustomers:     number
  newCustomersThisWeek:  number
  newCustomersThisMonth: number
  newCustomersThisYear:  number
  newReviewsThisWeek:    number
  totalVisitsThisMonth:  number
  totalVisitsThisYear:   number
  birthdaysThisMonth:    number
  anniversariesThisMonth:number
}

// ─── Revenue & menu intelligence ──────────────────────────────────────────────

export interface RevenueInsights {
  days:   number
  totals: { revenue: number; orders: number; itemsSold: number }
  topItems: { name: string; quantity: number; revenue: number }[]
  byOutlet: { outletId: string; name: string; revenue: number; orders: number }[]
  daily:       { date: string; revenue: number; orders: number; visits: number; newCustomers: number; newReviews: number }[]
  hourlyToday: { hour: number; revenue: number; orders: number; visits: number }[]
}

export interface HeatmapData {
  days:        number
  grid:        number[][]  // [dayOfWeek 0=Sun..6=Sat][hour 0..23]
  maxCount:    number
  totalVisits: number
  busiest:     { dow: number; hour: number; count: number } | null
}

export interface MenuPerformance {
  days:       number
  totalItems: number
  slowest: {
    menuItemId:  string
    name:        string
    outletName:  string | null
    price:       number | null
    isAvailable: boolean
    quantity:    number
    revenue:     number
  }[]
}

// ─── Outlets ──────────────────────────────────────────────────────────────────

export interface Outlet {
  id:            string
  name:          string
  code:          string
  slug:          string
  address:       string | null
  googleMapsUrl: string | null
  isActive:      boolean
}

export interface OutletDetail {
  outlet: Outlet
  stats: OutletStats & { starDistribution: { stars: number; count: number }[] }
  recentCustomers: {
    id: string; fullName: string; phone: string
    totalVisits: number; lastVisitDate: string | null; createdAt: string
  }[]
  recentReviews: (Review & { customer?: { fullName: string; phone: string } })[]
  recentVisits:  { id: string; visitType: 'qr_scan' | 'payment'; visitedAt: string; customer?: { fullName: string; phone: string } }[]
}

export interface OutletStats {
  outletId:               string
  outletName:             string
  outletCode:             string
  outletSlug:             string
  googleMapsUrl:          string | null
  totalCustomers:         number
  totalReviews:           number
  totalVisits:            number
  averageRating:          number | null
  inactiveCustomers:      number
  newCustomersThisWeek:   number
  newCustomersThisMonth:  number
  newCustomersThisYear:   number
  reviewsThisWeek:        number
  visitsThisMonth:        number
  birthdaysThisMonth:     number
  anniversariesThisMonth: number
}

// ─── Customers ────────────────────────────────────────────────────────────────

export interface Customer {
  id:                      string
  fullName:                string
  phone:                   string
  email:                   string | null
  gender:                  string
  maritalStatus:           string
  birthDate:               string | null
  anniversaryDate:         string | null
  totalVisits:             number
  totalReviews?:           number
  lastVisitDate:           string | null
  hasSubmittedFirstReview: boolean
  firstVisitOutletId:      string
  createdAt:               string
  firstVisitOutlet?:       { name: string; code: string }
  // Customer Lifetime Value — total served-order spend (list + detail endpoints)
  clv?:                    number
  orderCount?:             number
  // Only present on the single-customer /:id endpoint
  lastOrderAt?:            string | null
  visits?:                 { id: string; visitType: 'qr_scan' | 'payment'; visitedAt: string; outlet?: { name: string; code: string } }[]
  reviews?:                Review[]
}

export interface CustomerSummary {
  totalCustomers:    number
  totalSpend:        number
  spendingCustomers: number
  avgSpend:          number
  activeGuests:      number
  retentionRate:     number
  reviewRate:        number
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export interface Review {
  id:                string
  stars:             number
  reviewType:        'first_visit' | 'repeat'
  reviewText:        string | null
  createdAt:         string
  customerId:        string
  outletId:          string
  sentimentLabel?:   'positive' | 'negative' | 'neutral' | 'mixed' | null
  sentimentScore?:   number | null
  sentimentKeywords?: string[]
  customer?:         { fullName: string; phone: string; email?: string | null; gender?: string }
  outlet?:           { name: string; code: string; googleMapsUrl: string | null }
}

export interface ReviewSummary {
  averageRating: number | null
  totalReviews:  number
  distribution:  { stars: number; count: number }[]
}

// ─── Visits ───────────────────────────────────────────────────────────────────

export interface Visit {
  id:               string
  visitType:        'qr_scan' | 'payment'
  visitedAt:        string
  customerId:       string | null
  outletId:         string
  converted:        boolean
  isRepeatVisitor:  boolean
  customer?:        { fullName: string; phone: string } | null
  outlet?:          { name: string; code: string }
  deviceId?:        string | null
}

export interface VisitSummary {
  totalVisits: number
  qrScans:     number
  payments:    number
}

// ─── Automation Templates ─────────────────────────────────────────────────────

export interface AutomationTemplate {
  key:         string
  label:       string
  channel:     'whatsapp' | 'email'
  trigger:     'automatic' | 'manual'
  triggerDesc: string
  subject:     string | null
  body:        string
  imageUrl:    string | null
  linkUrl:     string | null
  isActive:    boolean
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export interface MenuItem {
  id:            string
  categoryId:    string
  name:          string
  description:   string | null
  price:         string | null
  priceVariants: Record<string, number> | null
  isVeg:         boolean
  isAvailable:   boolean
  imageUrl:      string | null
  displayOrder:  number | null
  createdAt:     string
  updatedAt:     string
}

export interface MenuCategory {
  id:           string
  name:         string
  displayOrder: number | null
  isActive:     boolean
  outletId:     string | null
  createdAt:    string
  outlet?:      { id: string; name: string; code: string }
  items:        MenuItem[]
}

// ─── Orders / KDS ─────────────────────────────────────────────────────────────

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled'
export type OrderSource = 'customer' | 'staff'
export type ServiceType = 'table' | 'self'
export type CancelledBy = 'staff' | 'customer'

export interface OrderItem {
  id:            string
  orderId:       string
  menuItemId:    string | null
  nameSnapshot:  string
  variantLabel:  string | null
  priceSnapshot: string | null
  quantity:      number
  note:          string | null
}

export interface Order {
  id:          string
  outletId:    string
  customerId:  string | null
  deviceId:    string | null
  createdById: string | null
  status:      OrderStatus
  source:      OrderSource
  serviceType: ServiceType
  boardNumber: string | null
  note:        string | null
  cancelledBy: CancelledBy | null
  closedAt:    string | null
  dailyNumber: number | null
  businessDate: string | null
  createdAt:   string
  updatedAt:   string
  items:       OrderItem[]
  outlet?:     { name: string; code: string }
}

export interface OrderSummary {
  from:                string
  to:                  string
  servedCount:         number
  cancelledByStaff:    number
  cancelledByCustomer: number
  cancelledCount:      number
  activeCount:         number
  itemsSold:           number
  revenue:             number
  topItems:            { name: string; quantity: number }[]
}

/** Payload pushed over the KDS SSE stream. */
export type OrderEvent =
  | { type: 'created'; order: Order }
  | { type: 'status';  order: Order }

// ─── Table Reservations ─────────────────────────────────────────────────────────

export type TableZone = 'ac' | 'non_ac' | 'outdoor'
export type TableShape = 'square' | 'round' | 'rect'
export type ReservationStatus =
  | 'held' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show' | 'expired'

export interface RestaurantTable {
  id:          string
  outletId:    string
  name:        string
  capacity:    number
  zone:        TableZone
  isActive:    boolean
  isBlocked:   boolean
  blockReason: string | null
  sortOrder:   number | null
  posX:        number | null
  posY:        number | null
  shape:       TableShape
  createdAt:   string
  updatedAt:   string
}

// ─── Floor view (live table states) ─────────────────────────────────────────────

export type FloorStatus = 'available' | 'reserved' | 'occupied' | 'blocked'

export interface FloorTable {
  id:          string
  name:        string
  capacity:    number
  zone:        TableZone
  posX:        number | null
  posY:        number | null
  shape:       TableShape
  isBlocked:   boolean
  blockReason: string | null
  status:      FloorStatus
  current: {
    id:            string
    guestName:     string
    partySize:     number
    reservedAt:    string
    status:        ReservationStatus
    bookingCode:   string
    joinRequested: boolean
    tableCount:    number
  } | null
  upcomingCount: number
}

// ─── Walk-in waitlist ────────────────────────────────────────────────────────────

export type WaitlistStatus = 'waiting' | 'seated' | 'left' | 'no_show'

export interface WaitlistEntry {
  id:            string
  outletId:      string
  guestName:     string
  guestPhone:    string
  partySize:     number
  status:        WaitlistStatus
  quotedMinutes: number | null
  note:          string | null
  tableId:       string | null
  seatedAt:      string | null
  createdAt:     string
  updatedAt:     string
}

export interface CalendarDay { date: string; count: number; covers: number }

export interface Reservation {
  id:              string
  outletId:        string
  tableId:         string
  customerId:      string | null
  deviceId:        string | null
  guestName:       string
  guestPhone:      string
  guestEmail:      string | null
  partySize:       number
  reservedAt:      string
  durationMinutes: number
  status:          ReservationStatus
  holdExpiresAt:   string | null
  bookingCode:     string
  source:          OrderSource
  createdById:     string | null
  specialRequests: string | null
  occasion:        string | null
  dietaryNotes:    string | null
  reminderSentAt:  string | null
  joinRequested:   boolean
  cancelledBy:     CancelledBy | null
  confirmedAt:     string | null
  createdAt:       string
  updatedAt:       string
  table?:          Pick<RestaurantTable, 'id' | 'name' | 'zone' | 'capacity'>
  additionalTables?: { table: Pick<RestaurantTable, 'id' | 'name' | 'zone' | 'capacity'> }[]
  outlet?:         { id: string; name: string; code: string }
}

export interface ReservationSettings {
  id:                         string
  name:                       string
  reservationsEnabled:        boolean
  reservationOpenTime:        string | null
  reservationCloseTime:       string | null
  reservationSlotMinutes:     number
  reservationDurationMinutes: number
  reservationHoldMinutes:     number
}

/** Payload pushed over the reservations SSE stream. */
export type ReservationEvent =
  | { type: 'created';  reservation: Reservation }
  | { type: 'status';   reservation: Reservation }
  | { type: 'table' }
  | { type: 'waitlist' }
