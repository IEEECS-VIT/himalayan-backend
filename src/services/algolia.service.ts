import { algoliasearch } from "algoliasearch"
import type {
  AlgoliaProductRecord,
  AlgoliaSearchResponse,
  SearchFilters,
  Product,
  ProductVariant,
} from "../types/algolia"

export class AlgoliaService {
  private client: ReturnType<typeof algoliasearch>
  private indexName: string

  constructor(
    private readonly appId: string,
    private readonly apiKey: string,
    indexName = "products",
  ) {
    if (!appId || appId.trim() === "") {
      throw new Error("appId is required for AlgoliaService")
    }

    if (!apiKey || apiKey.trim() === "") {
      throw new Error("apiKey is required for AlgoliaService")
    }

    this.client = algoliasearch(appId.trim(), apiKey.trim())
    this.indexName = indexName
  }

  async initializeIndex(): Promise<void> {
    try {
      await this.testConnection()

      await this.client.setSettings({
        indexName: this.indexName,
        indexSettings: {
          searchableAttributes: ["product_title", "sku", "option_value", "categories", "tags"],
          attributesForFaceting: [
            "filterOnly(currency_code)",
            "filterOnly(categories)",
            "filterOnly(tags)",
            "filterOnly(status)",
            "price",
            "stocked_quantity",
          ],
          customRanking: ["desc(stocked_quantity)", "asc(price)"],
          replicas: [`${this.indexName}_price_asc`, `${this.indexName}_price_desc`],
        },
      })
    } catch (error) {
      throw error
    }
  }

  private async testConnection(): Promise<void> {
    try {
      await this.client.getSettings({ indexName: this.indexName })
    } catch (error) {
      throw new Error(`Failed to connect to Algolia: ${error.message}`)
    }
  }

  private validateProduct(product: Product): boolean {
    return !!(product && product.id && product.title && product.variants?.length)
  }

  private validateVariant(variant: ProductVariant, productId: string): boolean {
    return !!(variant && variant.id)
  }

  private validateAlgoliaRecord(record: AlgoliaProductRecord): boolean {
    return !!(record && record.objectID && record.product_title)
  }

  private extractInventoryQuantity(variant: ProductVariant): number {
    const possibleFields = [
      "inventory_quantity",
      "quantity",
      "stock_quantity",
      "available_quantity",
      "manage_inventory",
    ]

    for (const field of possibleFields) {
      if (variant[field] !== undefined && variant[field] !== null) {
        return this.safeParseNumber(variant[field])
      }
    }

    if (variant.inventory_items && Array.isArray(variant.inventory_items)) {
      return variant.inventory_items.reduce((total, item) => {
        const itemQuantity = this.safeParseNumber(item.stocked_quantity || item.quantity || 0)
        return total + itemQuantity
      }, 0)
    }

    if (variant.inventory && typeof variant.inventory === "object") {
      return this.safeParseNumber(
        variant.inventory.stocked_quantity || variant.inventory.quantity || variant.inventory.available_quantity || 0,
      )
    }

    return 0
  }

// Updated transformProductToRecord method to ensure handle is properly set
private transformProductToRecord(product: Product, variant: ProductVariant): AlgoliaProductRecord {
  const stockedQuantity = this.extractInventoryQuantity(variant)

  const record: AlgoliaProductRecord = {
    objectID: `${product.id}_${variant.id}`,
    id: `${product.id}_${variant.id}`,
    product_id: product.id, // This ensures product_id is always included
    variant_id: variant.id,
    product_title: product.title,
    variant_title: variant.title || product.title,
    sku: variant.sku || "",
    price: this.safeParseNumber(variant.prices?.[0]?.amount) || 0,
    currency_code: variant.prices?.[0]?.currency_code || "usd",
    stocked_quantity: stockedQuantity,
    created_at: this.safeParseDate(product.created_at),
    updated_at: this.safeParseDate(product.updated_at),
    status: product.status || "draft",
    // Enhanced handle generation - fallback to product title slug if handle is missing
    handle: product.handle || this.generateHandleFromTitle(product.title),
    thumbnail: product.thumbnail || "",
    categories: this.safeExtractArray(product.categories ?? [], "name") || [],
    tags: this.safeExtractArray(product.tags ?? [], "value") || [],
  }

  if (variant.options?.length) {
    const option = variant.options[0]
    if (option) {
      record.option_name = option.option?.title || ""
      record.option_value = option.value || ""
    }
  }

  return record
}

/**
 * Generates a URL-friendly handle (slug) from a product title.
 */
private generateHandleFromTitle(title: string): string {
  if (!title) return ""
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

  private safeParseNumber(value: any): number {
    if (typeof value === "number") return value
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }

  private safeParseDate(value: any): string {
    try {
      const date = new Date(value)
      return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
    } catch {
      return new Date().toISOString()
    }
  }

  private safeExtractArray(items: any[], property: string): string[] {
    try {
      if (!Array.isArray(items)) return []
      return items
        .filter((item) => item && typeof item === "object" && item[property])
        .map((item) => String(item[property]))
        .filter((value) => value.trim() !== "")
    } catch {
      return []
    }
  }

  async indexAlgoliaRecords(records: AlgoliaProductRecord[]): Promise<void> {
    try {
      if (!Array.isArray(records) || records.length === 0) return

      const validRecords = records.filter((record) => this.validateAlgoliaRecord(record))
      if (validRecords.length === 0) return

      const batchSize = 1000
      for (let i = 0; i < validRecords.length; i += batchSize) {
        const batch = validRecords.slice(i, i + batchSize)
        await this.client.saveObjects({
          indexName: this.indexName,
          objects: batch,
        })
      }

      console.log(`Indexed ${validRecords.length} products to Algolia.`)
    } catch (error) {
      throw error
    }
  }

  async indexProducts(products: Product[]): Promise<void> {
    try {
      if (!Array.isArray(products) || products.length === 0) return

      const records: AlgoliaProductRecord[] = []

      for (const product of products) {
        if (!this.validateProduct(product)) continue

        for (const variant of product.variants || []) {
          if (!this.validateVariant(variant, product.id)) continue

          try {
            const record = this.transformProductToRecord(product, variant)
            records.push(record)
          } catch {
            continue
          }
        }
      }

      if (records.length === 0) return

      await this.indexAlgoliaRecords(records)
    } catch (error) {
      throw error
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      if (!productId || productId.trim() === "") {
        throw new Error("Product ID is required for deletion")
      }

      const searchResults = await this.client.searchSingleIndex({
        indexName: this.indexName,
        searchParams: {
          query: "",
          filters: `product_id:${productId}`,
          hitsPerPage: 1000,
        },
      })

      const objectIDs = searchResults.hits.map((hit) => hit.objectID)

      if (objectIDs.length > 0) {
        await this.client.deleteObjects({
          indexName: this.indexName,
          objectIDs,
        })
      }
    } catch (error) {
      throw error
    }
  }

  async updateProduct(product: Product): Promise<void> {
    try {
      if (!this.validateProduct(product)) {
        throw new Error(`Product validation failed for product ${product.id}`)
      }

      await this.deleteProduct(product.id)
      await this.indexProducts([product])
    } catch (error) {
      throw error
    }
  }
// Updated search method with enhanced debugging for product_id and handle
async search(query: string, filters: SearchFilters = {}, page = 0, hitsPerPage = 20): Promise<AlgoliaSearchResponse> {
  try {
    const filterArray: string[] = []

    if (filters.category) filterArray.push(`categories:"${filters.category}"`)
    if (filters.currency_code) filterArray.push(`currency_code:${filters.currency_code}`)
    if (filters.price_min !== undefined || filters.price_max !== undefined) {
      filterArray.push(`price:${filters.price_min || 0} TO ${filters.price_max || Number.MAX_SAFE_INTEGER}`)
    }
    if (filters.in_stock) filterArray.push("stocked_quantity > 0")
    if (filters.tags?.length) {
      const tagsFilter = filters.tags.map((tag) => `tags:"${tag}"`).join(" OR ")
      filterArray.push(`(${tagsFilter})`)
    }
    filterArray.push("status:published")

    const results = await this.client.searchSingleIndex({
      indexName: this.indexName,
      searchParams: {
        query,
        page,
        hitsPerPage,
        filters: filterArray.join(" AND "),
        attributesToRetrieve: [
          "objectID",
          "product_id",     // Explicitly included
          "variant_id",
          "product_title",
          "variant_title",
          "sku",
          "price",
          "currency_code",
          "option_name",
          "option_value",
          "stocked_quantity",
          "thumbnail",
          "handle",         // Explicitly included
          "categories",
          "tags",
        ],
      },
    })
// Transform results to ensure product_id and handle are always present
    const enhancedHits = results.hits.map((hit: any) => ({
      ...hit,
      product_id: hit.product_id || hit.objectID?.split('_')[0], // Fallback extraction
      handle: hit.handle || '', // Ensure handle is never undefined
    }))

      return {
        hits: results.hits as AlgoliaProductRecord[],
        nbHits: results.nbHits ?? 0,
        page: results.page ?? 0,
        nbPages: results.nbPages ?? 0,
        hitsPerPage: results.hitsPerPage ?? hitsPerPage,
        processingTimeMS: results.processingTimeMS,
        query: results.query,
      }
    } catch (error) {
      throw error
    }
  }

  async clearIndex(): Promise<void> {
    try {
      await this.client.clearObjects({ indexName: this.indexName })
    } catch (error) {
      throw error
    }
  }

  async getIndexStats(): Promise<any> {
    try {
      const settings = await this.client.getSettings({ indexName: this.indexName })
      return { indexName: this.indexName, settings }
    } catch (error) {
      throw error
    }
  }
}
