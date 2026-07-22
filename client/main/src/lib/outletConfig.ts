export interface OutletConfig {
  id: string
  name: string
  location: string
  hasMenu: boolean
}

export const outletConfig: Record<string, OutletConfig> = {
  mumbai:  { id: 'mumbai',  name: 'Napkiq Mumbai',  location: 'Mumbai, Pune, Maharashtra', hasMenu: true },
  pune: { id: 'pune', name: 'Napkiq Pune', location: 'Pune, Maharashtra',          hasMenu: true },
  delhi:   { id: 'delhi',   name: 'Napkiq Delhi',   location: 'Delhi, Pune, Maharashtra',   hasMenu: true },
  bangalore:   { id: 'bangalore',   name: 'Napkiq Bangalore',   location: 'Bangalore, Pune, Maharashtra',   hasMenu: true },
}
