export type ReviewType = 'first_visit' | 'repeat'

export interface Review {
  id: string
  customerId: string
  customerName: string
  outletId: string
  outletName: string
  reviewText: string | null
  stars: number
  reviewType: ReviewType
  postedToGoogle: boolean
  isVisible: boolean
  createdAt: string
}

export interface CreateReviewRequest {
  customerId: string
  outletId: string
  reviewText?: string
  stars: number
  reviewType: ReviewType
}
