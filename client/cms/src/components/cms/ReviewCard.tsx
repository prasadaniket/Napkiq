import type { Review } from '@/types/api'
import { format } from 'date-fns'

interface ReviewCardProps {
  review: Review
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const stars = Array.from({ length: 5 }, (_, i) => i < review.stars)

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{review.customer?.fullName ?? 'Anonymous'}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{review.outlet?.name ?? 'Unknown Outlet'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            {stars.map((filled, i) => (
              <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke={filled ? '#f59e0b' : 'var(--color-border-strong)'} strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4 }}>
            {format(new Date(review.createdAt), 'dd MMM yyyy')}
          </div>
        </div>
      </div>
      
      {review.reviewText && (
        <p style={{ fontSize: 13.5, color: 'var(--color-text-2)', lineHeight: 1.6, margin: '0 0 12px 0' }}>
          "{review.reviewText}"
        </p>
      )}
      
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{
          display: 'inline-flex', padding: '2px 8px', borderRadius: 99,
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
          background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-3)'
        }}>
          {review.reviewType === 'first_visit' ? 'First Visit' : 'Repeat Visit'}
        </span>
      </div>
    </div>
  )
}
