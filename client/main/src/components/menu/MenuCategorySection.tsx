import type { MenuItem, MenuCategory } from '@/types/menu'
import MenuItemCard from './MenuItemCard'

interface MenuCategorySectionProps {
  category: MenuCategory
  items: MenuItem[]
  getQuantity: (item: MenuItem, variantLabel: string | null) => number
  onUpdateQuantity: (item: MenuItem, change: number, variantLabel: string | null) => void
}

export default function MenuCategorySection({ category, items, getQuantity, onUpdateQuantity }: MenuCategorySectionProps) {
  if (items.length === 0) return null

  return (
    <div className="mb-6">
      <div className="accent-tint-primary px-4 py-2 rounded-lg mb-2">
        <h3 className="font-bold text-gradient-primary text-base">{category.name}</h3>
        <p className="text-xs text-secondary-light">{items.length} items</p>
      </div>
      <div className="bg-white rounded-xl px-4 shadow-sm">
        {items.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            getQuantity={(variantLabel) => getQuantity(item, variantLabel)}
            onUpdateQuantity={(change, variantLabel) => onUpdateQuantity(item, change, variantLabel)}
          />
        ))}
      </div>
    </div>
  )
}
