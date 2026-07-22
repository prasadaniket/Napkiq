'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import gsap from 'gsap'

// ─── Nav item type ─────────────────────────────────────────────────────────────

interface NavItem {
  href:        string
  label:       string
  icon:        React.ReactNode
  badge?:      string
  badgeColor?: string
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

const Icon = {
  Analytics: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Customers: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Reviews: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Outlets: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Visits: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Automation: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  Menu: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M3 12h18M3 18h18"/>
    </svg>
  ),
  Kitchen: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 11l1-7h16l1 7"/><path d="M4 11h16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>
      <line x1="8" y1="16" x2="8" y2="21"/><line x1="16" y1="16" x2="16" y2="21"/>
    </svg>
  ),
  Orders: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  Reservations: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      <path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>
    </svg>
  ),
  Birthday: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/>
      <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/>
      <path d="M2 21h20"/>
      <path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/>
    </svg>
  ),
  Anniversary: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  Celebrations: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/>
      <line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  ),
  Vault: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <rect x="9" y="10" width="6" height="5" rx="1"/>
      <circle cx="12" cy="12.5" r="1" fill="currentColor"/>
    </svg>
  ),
  Profile: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Logout: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

// ─── Categorized Section Grouping Config ────────────────────────────────────────

interface NavSection {
  title: string
  items: NavItem[]
}

const getNavSections = (isAdmin: boolean, isOwner: boolean): NavSection[] => [
  {
    title: 'OVERVIEW & MANAGEMENT',
    items: [
      { href: '/analytics', label: 'Analytics', icon: <Icon.Analytics /> },
      ...(isAdmin || isOwner ? [{ href: '/outlets', label: 'Outlets', icon: <Icon.Outlets /> }] : []),
      { href: '/customers', label: 'Guests', icon: <Icon.Customers /> },
    ],
  },
  {
    title: 'RESTAURANT OPERATIONS',
    items: [
      { href: '/kds', label: 'Kitchen', icon: <Icon.Kitchen /> },
      { href: '/reservations', label: 'Reservations', icon: <Icon.Reservations /> },
      { href: '/celebrations', label: 'Celebrations', icon: <Icon.Celebrations /> },
    ],
  },
  {
    title: 'SECURITY & AUTOMATION',
    items: [
      { href: '/vault', label: 'Vault', icon: <Icon.Vault />, badge: 'COMING SOON', badgeColor: '#6B7280' },
      ...(isAdmin ? [{ href: '/automation', label: 'Automation', icon: <Icon.Automation /> }] : []),
    ],
  },
  {
    title: 'ACCOUNT & SYSTEM',
    items: [
      { href: '/profile', label: 'Profile & Settings', icon: <Icon.Profile /> },
    ],
  },
]

// Sub-items shown under the collapsible "Guests" group (customer-relationship views).
const GUESTS_CHILDREN: NavItem[] = [
  { href: '/customers', label: 'Customers', icon: <Icon.Customers /> },
  { href: '/reviews',   label: 'Reviews',   icon: <Icon.Reviews /> },
  { href: '/visits',    label: 'Visits',    icon: <Icon.Visits /> },
]
const GUESTS_PATHS = GUESTS_CHILDREN.map((c) => c.href)

// ─── Role label ────────────────────────────────────────────────────────────────

function roleLabel(role: string | undefined) {
  if (role === 'admin')           return 'Admin · UniCord'
  if (role === 'owner')           return 'Owner'
  if (role === 'franchise_owner') return 'Franchise Owner'
  return role ?? ''
}

function roleBadgeClass(role: string | undefined) {
  if (role === 'admin')           return 'role-badge role-badge-admin'
  if (role === 'owner')           return 'role-badge role-badge-owner'
  return 'role-badge role-badge-franchise'
}

// ─── Sidebar component ─────────────────────────────────────────────────────────

export default function CMSSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, logout, isAdmin, isOwner } = useAuth()

  const [celebrationsOpen, setCelebrationsOpen] = useState(pathname.startsWith('/celebrations'))
  const [guestsOpen, setGuestsOpen] = useState(GUESTS_PATHS.some((p) => pathname.startsWith(p)))
  const dropdownRef = useRef<HTMLDivElement>(null)
  const guestsDropdownRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownRef.current) return

    if (celebrationsOpen) {
      gsap.killTweensOf(dropdownRef.current)
      dropdownRef.current.style.display = 'flex'
      gsap.fromTo(dropdownRef.current,
        { height: 0, opacity: 0 },
        {
          height: 'auto',
          opacity: 1,
          duration: 0.35,
          ease: 'power3.out'
        }
      )
    } else {
      gsap.killTweensOf(dropdownRef.current)
      gsap.to(dropdownRef.current, {
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'power3.inOut',
        onComplete: () => {
          if (dropdownRef.current) dropdownRef.current.style.display = 'none'
        }
      })
    }
  }, [celebrationsOpen])

  useEffect(() => {
    if (!guestsDropdownRef.current) return

    if (guestsOpen) {
      gsap.killTweensOf(guestsDropdownRef.current)
      guestsDropdownRef.current.style.display = 'flex'
      gsap.fromTo(guestsDropdownRef.current,
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.35, ease: 'power3.out' }
      )
    } else {
      gsap.killTweensOf(guestsDropdownRef.current)
      gsap.to(guestsDropdownRef.current, {
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'power3.inOut',
        onComplete: () => {
          if (guestsDropdownRef.current) guestsDropdownRef.current.style.display = 'none'
        }
      })
    }
  }, [guestsOpen])

  useEffect(() => {
    const updateIndicator = () => {
      if (!navRef.current || !indicatorRef.current) return
      const activeEl = navRef.current.querySelector('.sidebar-link.active') as HTMLElement | null
      
      if (activeEl) {
        const parentRect = navRef.current.getBoundingClientRect()
        const activeRect = activeEl.getBoundingClientRect()

        const top = activeRect.top - parentRect.top
        const height = activeRect.height
        const left = activeRect.left - parentRect.left
        const width = activeRect.width

        const currentOpacity = gsap.getProperty(indicatorRef.current, 'opacity')
        if (currentOpacity === 0) {
          gsap.set(indicatorRef.current, { top, height, left, width })
        }

        gsap.to(indicatorRef.current, {
          top,
          height,
          left,
          width,
          opacity: 1,
          duration: 0.35,
          ease: 'power3.out',
          overwrite: 'auto'
        })
      } else {
        gsap.to(indicatorRef.current, {
          opacity: 0,
          duration: 0.25,
          ease: 'power2.inOut',
          overwrite: 'auto'
        })
      }
    }

    // Delay slightly to allow the collapsible DOM section height transition to trigger / finish
    const timer = setTimeout(updateIndicator, 50)

    window.addEventListener('resize', updateIndicator)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateIndicator)
    }
  }, [pathname, searchParams, celebrationsOpen, guestsOpen])

  const navSections = getNavSections(isAdmin, isOwner)
  const outletName = user?.assignedOutletName

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="cms-sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/logo-circle.png"
            alt="Napkiq"
            style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: '50%' }}
          />
        </div>

        {/* Navigation */}
        <nav ref={navRef} className="sidebar-nav" style={{ position: 'relative' }}>
          {/* Sliding active indicator pill */}
          <div
            ref={indicatorRef}
            style={{
              position: 'absolute',
              background: 'var(--color-primary-dim)',
              borderRadius: 'var(--radius-md)',
              pointerEvents: 'none',
              zIndex: 0,
              opacity: 0,
            }}
          />
          {/* Outlet badge for franchise owners */}
          {outletName && (
            <div style={{
              background: 'rgba(0,2,29,0.03)',
              border: '1px solid rgba(0,2,29,0.06)',
              borderRadius: '8px',
              padding: '8px 10px',
              marginBottom: '8px',
              fontSize: '11.5px',
              color: 'rgba(0,2,29,0.6)',
            }}>
              <span style={{ color: 'rgba(0,2,29,0.3)', marginRight: '5px' }}>📍</span>
              {outletName}
            </div>
          )}

          {navSections.map((section, sIdx) => (
            <div key={section.title} className={sIdx > 0 ? 'mt-4' : ''}>
              <div className="sidebar-section-label text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                {section.title}
              </div>

              {section.items.map((item) => {
                if (item.label === 'Guests') {
                  const isGuestsActive = GUESTS_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
                  return (
                    <div key={item.label} className="flex flex-col">
                      <button
                        onClick={() => setGuestsOpen(!guestsOpen)}
                        className={`sidebar-link ${isGuestsActive ? 'active' : ''}`}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="sidebar-icon">{item.icon}</span>
                          {item.label}
                        </div>
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          style={{ transition: 'transform 0.2s', transform: guestsOpen ? 'rotate(90deg)' : 'none', opacity: 0.6 }}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>

                      <div
                        ref={guestsDropdownRef}
                        style={{
                          paddingLeft: '14px',
                          marginLeft: '18px',
                          borderLeft: '1.5px solid var(--color-primary-border)',
                          marginTop: '4px',
                          marginBottom: '4px',
                          display: isGuestsActive ? 'flex' : 'none',
                          flexDirection: 'column',
                          gap: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        {GUESTS_CHILDREN.map((child) => {
                          const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`sidebar-link hover:translate-x-1 ${childActive ? 'active' : ''}`}
                              style={{ fontSize: '12px', padding: '6px 8px', transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s, color 0.15s' }}
                            >
                              <span className="sidebar-icon" style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}>{child.icon}</span>
                              {child.label}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                }

                if (item.label === 'Celebrations') {
                  const isCelebrationsActive = pathname.startsWith('/celebrations')
                  return (
                    <div key={item.label} className="flex flex-col">
                      <button
                        onClick={() => setCelebrationsOpen(!celebrationsOpen)}
                        className={`sidebar-link ${isCelebrationsActive ? 'active' : ''}`}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="sidebar-icon">{item.icon}</span>
                          {item.label}
                        </div>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          style={{
                            transition: 'transform 0.2s',
                            transform: celebrationsOpen ? 'rotate(90deg)' : 'none',
                            opacity: 0.6
                          }}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>

                      <div 
                        ref={dropdownRef}
                        style={{
                          paddingLeft: '14px',
                          marginLeft: '18px',
                          borderLeft: '1.5px solid var(--color-primary-border)',
                          marginTop: '4px',
                          marginBottom: '4px',
                          display: pathname.startsWith('/celebrations') ? 'flex' : 'none',
                          flexDirection: 'column',
                          gap: '4px',
                          overflow: 'hidden'
                        }}
                      >
                        <Link
                          href="/celebrations?tab=birthdays"
                          className={`sidebar-link hover:translate-x-1 ${pathname === '/celebrations' && searchParams.get('tab') !== 'anniversaries' ? 'active' : ''}`}
                          style={{ 
                            fontSize: '12px', 
                            padding: '6px 8px',
                            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s, color 0.15s' 
                          }}
                        >
                          <span className="sidebar-icon" style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}><Icon.Birthday /></span>
                          Birthdays
                        </Link>
                        <Link
                          href="/celebrations?tab=anniversaries"
                          className={`sidebar-link hover:translate-x-1 ${pathname === '/celebrations' && searchParams.get('tab') === 'anniversaries' ? 'active' : ''}`}
                          style={{ 
                            fontSize: '12px', 
                            padding: '6px 8px',
                            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s, color 0.15s' 
                          }}
                        >
                          <span className="sidebar-icon" style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}><Icon.Anniversary /></span>
                          Anniversaries
                        </Link>
                      </div>
                    </div>
                  )
                }

                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                  >
                    <span className="sidebar-icon">{item.icon}</span>
                    {item.label}
                    {item.label === 'Automation' && (
                      <span style={{
                        marginLeft: 'auto',
                        background: 'rgba(214,66,56,0.15)',
                        color: '#D64238',
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '99px',
                        letterSpacing: '0.04em',
                      }}>ADMIN</span>
                    )}
                    {item.badge && item.label !== 'Automation' && (
                      <span style={{
                        marginLeft: 'auto',
                        background: item.badgeColor ? `${item.badgeColor}22` : 'rgba(245,147,0,0.18)',
                        color: item.badgeColor || '#D97706',
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1.5px 6px',
                        borderRadius: '99px',
                        letterSpacing: '0.05em',
                      }}>{item.badge}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className="sidebar-user">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{
              width: 30, height: 30,
              background: 'rgba(214,66,56,0.1)',
              border: '1px solid rgba(214,66,56,0.2)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, color: '#D64238',
              flexShrink: 0,
            }}>
              {user?.fullName?.charAt(0) ?? '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.fullName ?? '—'}
              </div>
              <div className="sidebar-user-role">
                {user?.username && <span style={{ color: 'rgba(0,2,29,0.3)', marginRight: '4px' }}>@{user.username}</span>}
              </div>
            </div>
          </div>

          <span className={roleBadgeClass(user?.role)}>
            {roleLabel(user?.role)}
          </span>

          <button className="sidebar-logout" onClick={logout}>
            <Icon.Logout />
            Sign out
          </button>

          {/* Footer Branding */}
          <div className="text-[10px] text-center text-slate-400 mt-3 pt-2.5 border-t border-slate-200/60 font-medium">
            Napkiq • <span className="text-slate-500 font-normal">Powered by UniCord Tech</span>
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav ────────────────────────────────────── */}
      <nav className="bottom-nav">
        {navSections.flatMap((s) => s.items).slice(0, 4).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
        <button className="bottom-nav-item" onClick={logout}>
          <Icon.Logout />
          Out
        </button>
      </nav>
    </>
  )
}
