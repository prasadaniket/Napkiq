export interface MenuCategory {
  id: string
  name: string
  displayOrder: number
  isActive: boolean
  items?: MenuItem[]
}

export interface MenuItem {
  id: string
  categoryId: string
  category: MenuCategory
  name: string
  description: string | null
  price: number | null
  priceVariants: Record<string, number> | null
  isVeg: boolean
  imageUrl: string | null
  isAvailable: boolean
  displayOrder: number
}
