'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import gsap from 'gsap'

interface Option {
  value: string
  label: string
}

interface GSAPDropdownProps {
  value: string
  onChange: (val: string) => void
  options: Option[]
  placeholder?: string
  icon?: React.ReactNode
  className?: string
  width?: string
}

export default function GSAPDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select option',
  icon,
  className = '',
  width = '190px'
}: GSAPDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const arrowRef = useRef<SVGSVGElement>(null)

  const selectedOption = options.find(o => o.value === value)

  useEffect(() => {
    if (!listRef.current || !arrowRef.current) return

    if (isOpen) {
      gsap.killTweensOf(listRef.current)
      gsap.killTweensOf(arrowRef.current)

      listRef.current.style.display = 'block'
      gsap.fromTo(listRef.current,
        { scaleY: 0.8, opacity: 0, transformOrigin: 'top center' },
        { scaleY: 1, opacity: 1, duration: 0.25, ease: 'power3.out' }
      )
      gsap.to(arrowRef.current, { rotate: 180, duration: 0.25, ease: 'power2.out' })
    } else {
      gsap.killTweensOf(listRef.current)
      gsap.killTweensOf(arrowRef.current)

      gsap.to(listRef.current, {
        scaleY: 0.8,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.inOut',
        onComplete: () => {
          if (listRef.current) listRef.current.style.display = 'none'
        }
      })
      gsap.to(arrowRef.current, { rotate: 0, duration: 0.25, ease: 'power2.out' })
    }
  }, [isOpen])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div 
      ref={containerRef}
      className={`relative select-none ${className}`}
      style={{ width }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 transition-all hover:bg-slate-50 hover:border-slate-300 outline-none cursor-pointer"
        style={{ height: '40px' }}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown ref={arrowRef} className="h-4 w-4 text-slate-400 shrink-0" />
      </button>

      {/* Options List */}
      <div
        ref={listRef}
        className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl z-50"
        style={{ display: 'none' }}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onChange(opt.value)
              setIsOpen(false)
            }}
            className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors border-none outline-none cursor-pointer ${
              value === opt.value
                ? 'bg-red-50 text-[#D64238]'
                : 'bg-transparent text-slate-700 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
