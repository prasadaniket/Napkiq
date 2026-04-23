'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import ReviewCard from '@/components/cms/ReviewCard'
import Loader from '@/components/ui/Loader'
import type { Review } from '@/types/api'
import type { PageResponse } from '@/types/api'

export default function ReviewsPage() {
  const { user, loading: authLoading } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    const outletParam = user?.assignedOutletId ? `&outletId=${user.assignedOutletId}` : ''
    api.get<PageResponse<Review>>(`/cms/reviews?page=${page}&size=20${outletParam}`)
      .then((res) => {
        setReviews(res.data.content)
        setTotalPages(res.data.totalPages)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, user?.assignedOutletId])

  if (authLoading || loading) return <Loader fullScreen />

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary">Reviews</h1>
        <p className="text-secondary-light text-sm mt-1">Customer feedback (view only)</p>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-12 text-secondary-light">No reviews yet.</div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="px-4 py-2 text-sm border border-neutral-light rounded-lg disabled:opacity-40 hover:border-[#E88C3A] transition-colors">
            ← Prev
          </button>
          <span className="px-4 py-2 text-sm text-secondary-light">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
            className="px-4 py-2 text-sm border border-neutral-light rounded-lg disabled:opacity-40 hover:border-[#E88C3A] transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
