import { prisma } from '../lib/prisma'

const menuData = [
  {
    category: 'Soups', order: 0,
    items: [
      { name: 'Rustic Fresh Tomato',  type: 'veg',             prices: [149] },
      { name: 'Cream of Soup',        type: 'veg/nonVeg',      prices: [159, 179], options: ['Mushroom', 'Corn', 'Chicken'] },
      { name: 'Minestrone Tomato',    type: 'veg',             prices: [159] },
      { name: 'Minestrone Pesto',     type: 'veg',             prices: [159] },
      { name: 'Sweet Corn Soup',      type: 'veg/nonVeg',      prices: [139, 159, 189] },
      { name: 'Manchow Soup',         type: 'veg/nonVeg',      prices: [149, 169, 199] },
      { name: 'Tom Yum',              type: 'veg/nonVeg',      prices: [149, 169, 199] },
      { name: 'Tom Kha',              type: 'veg/nonVeg',      prices: [159, 179, 209] },
      { name: 'Hot & Sour',           type: 'veg/nonVeg',      prices: [149, 169, 199] },
    ],
  },
  {
    category: 'Momos', order: 1,
    items: [
      { name: 'Veg Cheese Momo',      type: 'veg',    prices: [189] },
      { name: 'Veg Tibetan Momo',     type: 'veg',    prices: [199] },
      { name: 'Paneer Chilli Momo',   type: 'veg',    prices: [199] },
      { name: 'Chicken Cheese Momo',  type: 'nonVeg', prices: [219] },
      { name: 'Chicken Tibetan Momo', type: 'nonVeg', prices: [229] },
      { name: 'Chicken Chilli Momo',  type: 'nonVeg', prices: [229] },
    ],
  },
  {
    category: 'Garlic Bread & Anti-Pasto', order: 2,
    items: [
      { name: 'Plain Garlic Bread',          type: 'veg', prices: [149] },
      { name: 'Cheese Garlic Bread',         type: 'veg', prices: [179] },
      { name: 'Cheese Chilli Garlic Bread',  type: 'veg', prices: [179] },
      { name: 'Garlic Bread Delight',        type: 'veg', prices: [189] },
      { name: 'Garlic Bread Corn Jalapeno',  type: 'veg', prices: [199] },
      { name: 'Garlic Bread Supreme',        type: 'veg', prices: [219] },
    ],
  },
  {
    category: 'Baos', order: 3,
    items: [
      { name: 'BBQ Paneer Bao',         type: 'veg',         prices: [239] },
      { name: 'BBQ Chicken Bao',        type: 'nonVeg',      prices: [269] },
      { name: 'Devils Bao',             type: 'veg/nonVeg',  prices: [249, 269] },
      { name: 'Thai Basil Bao',         type: 'veg/nonVeg',  prices: [249, 269] },
      { name: 'Korean Fried Bao',       type: 'veg/nonVeg',  prices: [249, 269] },
      { name: 'Prawns Chilly Basil Bao',type: 'seafood',     prices: [289] },
    ],
  },
  {
    category: 'Fries', order: 4,
    items: [
      { name: 'Classic Fries',         type: 'veg',    prices: [149] },
      { name: 'Cheesy Fries',          type: 'veg',    prices: [179] },
      { name: 'Peri Peri Fries',       type: 'veg',    prices: [159] },
      { name: 'NYK Style Fries',       type: 'nonVeg', prices: [249] },
      { name: 'Butter Chicken Fries',  type: 'nonVeg', prices: [249] },
    ],
  },
  {
    category: 'Pizza', order: 5,
    items: [
      { name: 'Margherita',       type: 'veg',    prices: [189, 249] },
      { name: 'Farmhouse',        type: 'veg',    prices: [219, 319] },
      { name: 'Tandoori Paneer',  type: 'veg',    prices: [289, 429] },
      { name: 'Mexican Veg Pizza',type: 'veg',    prices: [259, 359] },
      { name: 'Peri Peri Chicken',type: 'nonVeg', prices: [269, 369] },
      { name: 'BBQ Chicken',      type: 'nonVeg', prices: [269, 369] },
    ],
  },
  {
    category: 'Pasta', order: 6,
    items: [
      { name: 'Arrabiata',    type: 'veg',    prices: [249, 269] },
      { name: 'Alfredo',      type: 'veg',    prices: [249, 269] },
      { name: 'Aglio Olio',   type: 'veg',    prices: [249, 269] },
      { name: 'Creamy Pesto', type: 'veg',    prices: [249, 269] },
      { name: 'Bolognese',    type: 'nonVeg', prices: [279] },
    ],
  },
  {
    category: 'Starters', order: 7,
    items: [
      { name: 'Exotic Pan Tossed Veg',  type: 'veg',      prices: [249] },
      { name: 'Crispy Chilli Potato',   type: 'veg',      prices: [249] },
      { name: 'Chicken Lollipop',       type: 'nonVeg',   prices: [269] },
      { name: 'Chicken Popcorn',        type: 'nonVeg',   prices: [269] },
      { name: 'Butter Garlic Prawns',   type: 'seafood',  prices: [319] },
    ],
  },
  {
    category: 'Rice & Noodles', order: 8,
    items: [
      { name: 'Fried Rice',              type: 'veg/nonVeg/seafood', prices: [239, 259, 299] },
      { name: 'Sichuan Rice / Noodles',  type: 'veg/nonVeg/seafood', prices: [249, 269, 319] },
      { name: 'Hakka Noodles',           type: 'veg/nonVeg/seafood', prices: [249, 269, 319] },
      { name: 'Triple Sichuan Rice',     type: 'veg/nonVeg/seafood', prices: [279, 299, 349] },
    ],
  },
  {
    category: 'Desserts', order: 9,
    items: [
      { name: 'Choco Lava Cake',  type: 'veg', prices: [129] },
      { name: 'Sizzling Brownie', type: 'veg', prices: [189] },
      { name: 'Baked Cheesecake', type: 'veg', prices: [229] },
    ],
  },
  {
    category: 'Beverages', order: 10,
    items: [
      { name: 'Ice Tea',         type: 'veg', prices: [149] },
      { name: 'Shakes',          type: 'veg', prices: [169] },
      { name: 'Mojito',          type: 'veg', prices: [159] },
      { name: 'Mocktails',       type: 'veg', prices: [159, 189] },
      { name: 'Fresh Lime Soda', type: 'veg', prices: [89] },
      { name: 'Cold Coffee',     type: 'veg', prices: [189] },
    ],
  },
]

function buildVariants(type: string, prices: number[]): Record<string, number> | null {
  if (prices.length <= 1) return null
  const keys = type.split('/')
  if (keys.length === prices.length) {
    const variants: Record<string, number> = {}
    keys.forEach((k, i) => { variants[k] = prices[i] })
    return variants
  }
  // size variants (e.g. pizza small/large)
  const sizeKeys = prices.length === 2 ? ['small', 'large'] : prices.map((_, i) => `option${i + 1}`)
  const variants: Record<string, number> = {}
  sizeKeys.forEach((k, i) => { variants[k] = prices[i] })
  return variants
}

async function main() {
  const outlet = await prisma.outlet.findFirst({
    where: { OR: [{ code: 'BSR' }, { slug: 'boisar' }] },
  })
  if (!outlet) { console.error('Boisar outlet not found. Create it first.'); process.exit(1) }
  console.log(`Seeding menu for outlet: ${outlet.name} (${outlet.id})`)

  // Clear existing menu for this outlet
  const existingCats = await prisma.menuCategory.findMany({ where: { outletId: outlet.id }, select: { id: true } })
  if (existingCats.length > 0) {
    const catIds = existingCats.map(c => c.id)
    await prisma.menuItem.deleteMany({ where: { categoryId: { in: catIds } } })
    await prisma.menuCategory.deleteMany({ where: { id: { in: catIds } } })
    console.log(`Cleared ${existingCats.length} existing categories.`)
  }

  let totalItems = 0
  for (const catData of menuData) {
    const category = await prisma.menuCategory.create({
      data: { name: catData.category, outletId: outlet.id, displayOrder: catData.order, isActive: true },
    })

    for (let i = 0; i < catData.items.length; i++) {
      const item = catData.items[i] as { name: string; type: string; prices: number[]; options?: string[] }
      const variants = buildVariants(item.type, item.prices)
      const isVeg = item.type === 'veg'

      await prisma.menuItem.create({
        data: {
          categoryId:    category.id,
          name:          item.name,
          description:   item.options ? item.options.join(', ') : null,
          price:         variants ? null : item.prices[0],
          priceVariants: variants ?? undefined,
          isVeg,
          isAvailable:   true,
          displayOrder:  i,
        },
      })
      totalItems++
    }
    console.log(`  ✓ ${catData.category} (${catData.items.length} items)`)
  }

  console.log(`\nDone! Seeded ${menuData.length} categories and ${totalItems} items for ${outlet.name}.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
