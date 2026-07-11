export interface Outlet {
  id: string
  code: string
  slug?: string
  name: string
  location: string
  address: string
  googlePlaceId: string
  googleMapsUrl: string
  instagramUrl: string | null
  facebookUrl: string | null
  isActive: boolean
  reservationsEnabled?: boolean
  reservationOpenTime?: string | null
  reservationCloseTime?: string | null
  reservationSlotMinutes?: number
  reservationDurationMinutes?: number
  reservationHoldMinutes?: number
  createdAt: string
  updatedAt: string
}
