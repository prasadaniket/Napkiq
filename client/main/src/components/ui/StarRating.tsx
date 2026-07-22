'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  label?: string
  value?: number
  onChange?: (stars: number) => void
  error?: string
  readOnly?: boolean
}

export default function StarRating({ label, value = 0, onChange, error, readOnly = false }: StarRatingProps) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="w-full">
      {label && (
        <p className="block text-sm font-medium text-secondary mb-1.5">{label}</p>
      )}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(star)}
            onMouseEnter={() => !readOnly && setHovered(star)}
            onMouseLeave={() => !readOnly && setHovered(0)}
            className={cn(
              'text-3xl transition-transform duration-100',
              !readOnly && 'hover:scale-110 cursor-pointer',
              readOnly && 'cursor-default'
            )}
          >
            <span className={cn(
              (hovered || value) >= star ? 'text-tertiary' : 'text-neutral-light'
            )}>
              ★
            </span>
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
    </div>
  )
}
