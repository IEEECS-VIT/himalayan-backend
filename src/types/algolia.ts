// types/algolia.ts

// Custom Medusa Product type definition
export interface Product {
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
  variants?: ProductVariant[]
}

// Custom Medusa ProductVariant type definition
export interface ProductVariant {
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

export type AlgoliaProductRecord = {
  objectID: string
  product_id: string
  variant_id: string
  product_title: string
  variant_title: string
  sku: string
  price: number
  currency_code: string
  stocked_quantity: number
  created_at: string
  updated_at: string
  status: string
  handle: string
  thumbnail: string
  categories: string[]
  tags: string[]
  option_name?: string
  option_value?: string
  [key: string]: unknown // Add index signature for compatibility
}

export interface SearchFilters {
  category?: string
  currency_code?: string
  price_min?: number
  price_max?: number
  in_stock?: boolean
  tags?: string[]
}

export interface AlgoliaSearchResponse {
  hits: AlgoliaProductRecord[]
  nbHits: number
  page: number
  nbPages: number
  hitsPerPage: number
  processingTimeMS: number
  query: string
}
