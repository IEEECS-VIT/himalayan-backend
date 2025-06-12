// services/algolia.service.ts
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
    console.log("=== ALGOLIA SERVICE CONSTRUCTOR DEBUG ===")
    console.log("appId received:", appId ? `SET (length: ${appId.length})` : "NOT SET")
    console.log("apiKey received:", apiKey ? `SET (length: ${apiKey.length})` : "NOT SET")
    console.log("indexName:", indexName)

    if (!appId || appId.trim() === "") {
      console.error("ERROR: appId is missing or empty in AlgoliaService constructor")
      throw new Error("appId is required for AlgoliaService")
    }

    if (!apiKey || apiKey.trim() === "") {
      console.error("ERROR: apiKey is missing or empty in AlgoliaService constructor")
      throw new Error("apiKey is required for AlgoliaService")
    }

    try {
      console.log("Creating Algolia client with algoliasearch()...")
      this.client = algoliasearch(appId.trim(), apiKey.trim())
      this.indexName = indexName
      console.log("Algolia client created successfully")
    } catch (error) {
      console.error("Error creating Algolia client:", error)
      throw error
    }
  }

  async initializeIndex(): Promise<void> {
    try {
      console.log("=== INITIALIZING ALGOLIA INDEX ===")
      console.log("Index name:", this.indexName)

      // Test connection first
      await this.testConnection()

      // Configure index settings using the new API
      const response = await this.client.setSettings({
        indexName: this.indexName,
        indexSettings: {
          searchableAttributes: ["product_title", "variant_title", "sku", "option_value", "categories", "tags"],
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

      console.log("Algolia index initialized successfully:", response)
    } catch (error) {
      console.error("Error initializing Algolia index:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      throw error
    }
  }

  private async testConnection(): Promise<void> {
    try {
      console.log("Testing Algolia connection...")
      const response = await this.client.getSettings({
        indexName: this.indexName,
      })
      console.log("Connection test successful")
    } catch (error) {
      console.error("Connection test failed:", error)
      throw new Error(`Failed to connect to Algolia: ${error.message}`)
    }
  }

  private validateProduct(product: Product): boolean {
    if (!product) {
      console.error("Product is null or undefined")
      return false
    }

    if (!product.id) {
      console.error("Product missing required field: id")
      return false
    }

    if (!product.title) {
      console.error(`Product ${product.id} missing required field: title`)
      return false
    }

    if (!product.variants || product.variants.length === 0) {
      console.error(`Product ${product.id} has no variants`)
      return false
    }

    return true
  }

  private validateVariant(variant: ProductVariant, productId: string): boolean {
    if (!variant) {
      console.error(`Product ${productId}: variant is null or undefined`)
      return false
    }

    if (!variant.id) {
      console.error(`Product ${productId}: variant missing required field: id`)
      return false
    }

    return true
  }

  private validateAlgoliaRecord(record: AlgoliaProductRecord): boolean {
    if (!record) {
      console.error("Algolia record is null or undefined")
      return false
    }

    if (!record.objectID) {
      console.error("Algolia record missing required field: objectID")
      return false
    }

    if (!record.product_title) {
      console.error(`Algolia record ${record.objectID} missing required field: product_title`)
      return false
    }

    return true
  }

  private transformProductToRecord(product: Product, variant: ProductVariant): AlgoliaProductRecord {
    try {
      // Ensure we have required fields
      if (!product.id) throw new Error(`Missing product.id for ${product.title}`)
      if (!variant.id) throw new Error(`Missing variant.id for product ${product.id}`)
      const record: AlgoliaProductRecord = {
        objectID: `${product.id}_${variant.id}`,
        id: `${product.id}_${variant.id}`,
        product_id: product.id,
        variant_id: variant.id,
        product_title: product.title,
        variant_title: variant.title || product.title,
        sku: variant.sku || "",
        price: this.safeParseNumber(variant.prices?.[0]?.amount) || 0,
        currency_code: variant.prices?.[0]?.currency_code || "usd",
        stocked_quantity: this.safeParseNumber(variant.inventory_quantity) || 0,
        created_at: this.safeParseDate(product.created_at),
        updated_at: this.safeParseDate(product.updated_at),
        status: product.status || "draft",
        handle: product.handle || "",
        thumbnail: product.thumbnail || "",
        categories: this.safeExtractArray(product.categories ?? [], "name") || [],
        tags: this.safeExtractArray(product.tags ?? [], "value") || [],
      }

      // Handle product options safely
      if (variant.options && Array.isArray(variant.options) && variant.options.length > 0) {
        const option = variant.options[0]
        if (option) {
          record.option_name = option.option?.title || ""
          record.option_value = option.value || ""
        }
      }

      return record
    } catch (error) {
      console.error(`Error transforming product ${product.id} variant ${variant.id}:`, error)
      throw error
    }
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
      if (typeof value === "string") {
        // Validate the date string
        const date = new Date(value)
        return isNaN(date.getTime()) ? new Date().toISOString() : value
      }
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString()
      }
      return new Date().toISOString()
    } catch (error) {
      console.warn("Error parsing date, using current date:", error)
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
    } catch (error) {
      console.warn(`Error extracting array property ${property}:`, error)
      return []
    }
  }

  // NEW METHOD: Index pre-transformed Algolia records directly
  async indexAlgoliaRecords(records: AlgoliaProductRecord[]): Promise<void> {
    try {
      console.log(`Indexing ${records.length} pre-transformed Algolia records...`)

      if (!Array.isArray(records) || records.length === 0) {
        console.warn("No records provided for indexing")
        return
      }

      // Validate records
      const validRecords = records.filter((record) => {
        if (!this.validateAlgoliaRecord(record)) {
          console.warn(`Skipping invalid record: ${record?.objectID || "unknown"}`)
          return false
        }
        return true
      })

      console.log(`Validated ${validRecords.length} out of ${records.length} records`)

      if (validRecords.length === 0) {
        console.warn("No valid records to index")
        return
      }

      // Batch index in chunks of 1000
      const batchSize = 1000
      for (let i = 0; i < validRecords.length; i += batchSize) {
        const batch = validRecords.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(validRecords.length / batchSize)

        console.log(`Indexing batch ${batchNumber}/${totalBatches} (${batch.length} records)`)

        try {
          const response = await this.client.saveObjects({
            indexName: this.indexName,
            objects: batch,
          })
          console.log(`Batch ${batchNumber} completed successfully`)
        } catch (error) {
          console.error(`Batch ${batchNumber} failed:`, error)
          throw error
        }
      }

      console.log(`Successfully indexed ${validRecords.length} Algolia records`)
    } catch (error) {
      console.error("Error indexing Algolia records:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      throw error
    }
  }

  // EXISTING METHOD: Index raw Product objects (transforms them first)
  async indexProducts(products: Product[]): Promise<void> {
    try {
      console.log(`Batch indexing ${products.length} products...`)

      if (!Array.isArray(products) || products.length === 0) {
        console.warn("No products provided for indexing")
        return
      }

      const records: AlgoliaProductRecord[] = []
      let skippedProducts = 0
      let processedVariants = 0

      for (const product of products) {
        if (!this.validateProduct(product)) {
          console.warn(`Skipping invalid product: ${product?.id || "unknown"}`)
          skippedProducts++
          continue
        }

        for (const variant of product.variants || []) {
          if (!this.validateVariant(variant, product.id)) {
            console.warn(`Skipping invalid variant for product ${product.id}`)
            continue
          }

          try {
            const record = this.transformProductToRecord(product, variant)
            records.push(record)
            processedVariants++
          } catch (error) {
            console.error(`Failed to transform variant ${variant.id} for product ${product.id}:`, error)
            continue
          }
        }
      }

      console.log(`Processed ${products.length - skippedProducts} products, ${processedVariants} variants`)

      if (records.length === 0) {
        console.warn("No valid records to index")
        return
      }

      // Use the new indexAlgoliaRecords method
      await this.indexAlgoliaRecords(records)
    } catch (error) {
      console.error("Error batch indexing products:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      throw error
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      console.log(`Deleting product: ${productId}`)

      if (!productId || productId.trim() === "") {
        throw new Error("Product ID is required for deletion")
      }

      // Find all records for this product
      const searchResults = await this.client.searchSingleIndex({
        indexName: this.indexName,
        searchParams: {
          query: "",
          filters: `product_id:${productId}`,
          hitsPerPage: 1000, // Ensure we get all variants
        },
      })

      const objectIDs = searchResults.hits.map((hit) => hit.objectID)

      if (objectIDs.length > 0) {
        await this.client.deleteObjects({
          indexName: this.indexName,
          objectIDs,
        })
        console.log(`Deleted ${objectIDs.length} records for product: ${productId}`)
      } else {
        console.log(`No records found for product: ${productId}`)
      }
    } catch (error) {
      console.error(`Error deleting product ${productId}:`, error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      throw error
    }
  }

  async updateProduct(product: Product): Promise<void> {
    try {
      console.log(`Updating product: ${product.title} (ID: ${product.id})`)

      // Validate product first
      if (!this.validateProduct(product)) {
        throw new Error(`Product validation failed for product ${product.id}`)
      }

      // Delete existing records first
      await this.deleteProduct(product.id)
      // Then index the updated product
      await this.indexProducts([product])
    } catch (error) {
      console.error(`Error updating product ${product.id}:`, error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      throw error
    }
  }

  async search(query: string, filters: SearchFilters = {}, page = 0, hitsPerPage = 20): Promise<AlgoliaSearchResponse> {
    try {
      console.log(`Searching with query: "${query}", filters:`, filters)

      const filterArray: string[] = []

      // Build filters
      if (filters.category) {
        filterArray.push(`categories:"${filters.category}"`)
      }

      if (filters.currency_code) {
        filterArray.push(`currency_code:${filters.currency_code}`)
      }

      if (filters.price_min !== undefined || filters.price_max !== undefined) {
        const priceFilter = `price:${filters.price_min || 0} TO ${filters.price_max || Number.MAX_SAFE_INTEGER}`
        filterArray.push(priceFilter)
      }

      if (filters.in_stock) {
        filterArray.push("stocked_quantity > 0")
      }

      if (filters.tags && filters.tags.length > 0) {
        const tagsFilter = filters.tags.map((tag) => `tags:"${tag}"`).join(" OR ")
        filterArray.push(`(${tagsFilter})`)
      }

      // Always filter for published products
      filterArray.push("status:published")

      console.log("Final filters:", filterArray.join(" AND "))

      const results = await this.client.searchSingleIndex({
        indexName: this.indexName,
        searchParams: {
          query,
          page,
          hitsPerPage,
          filters: filterArray.join(" AND "),
          attributesToRetrieve: [
            "objectID",
            "product_id",
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
            "handle",
            "categories",
            "tags",
          ],
        },
      })

      console.log(`Search completed: ${results.nbHits} hits found`)

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
      console.error("Error searching products:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      throw error
    }
  }

  async clearIndex(): Promise<void> {
    try {
      console.log("Clearing Algolia index...")
      await this.client.clearObjects({
        indexName: this.indexName,
      })
      console.log("Algolia index cleared successfully")
    } catch (error) {
      console.error("Error clearing Algolia index:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      throw error
    }
  }

  async getIndexStats(): Promise<any> {
    try {
      console.log("Getting index stats...")
      const settings = await this.client.getSettings({
        indexName: this.indexName,
      })

      return {
        indexName: this.indexName,
        settings,
      }
    } catch (error) {
      console.error("Error getting index stats:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
      throw error
    }
  }
}
