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
  fullName: string
  email: string
  role: 'admin' | 'owner' | 'franchise_owner'
  assignedOutletId: string | null
  assignedOutletName: string | null
}

export interface DashboardStats {
  totalCustomers: number
  totalReviews: number
  totalVisits: number
  inactiveCustomers: number
  averageRating: number | null
  birthdaysThisMonth: number
  anniversariesThisMonth: number
  newCustomersThisWeek: number
  newReviewsThisWeek: number
  outletStats: OutletStat[] | null
}

export interface OutletStat {
  outletCode: string
  outletName: string
  customers: number
  reviews: number
  visits: number
  avgRating: number | null
  inactiveCustomers: number
}
