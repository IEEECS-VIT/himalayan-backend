// types/medusa.ts - Alternative approach with custom Medusa types
export interface MedusaProduct {
  id: string
  title: string
  handle: string
  status: string
  thumbnail?: string
  created_at: Date
  updated_at: Date
  categories?: Array<{
    name: string
  }>
  tags?: Array<{
    value: string
  }>
  variants?: MedusaProductVariant[]
}

export interface MedusaProductVariant {
  id: string
  title?: string
  sku?: string
  inventory_quantity?: number
  prices?: Array<{
    amount: number
    currency_code: string
  }>
  options?: Array<{
    option?: {
      title: string
    }
    value: string
  }>
}
