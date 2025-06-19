// sync-published-products.ts
import dotenv from "dotenv"
dotenv.config()

import { AlgoliaService } from "../services/algolia.service"
import axios from "axios"

async function getVariantInventoryQuantity(variantId: string): Promise<number> {
  try {
    const response = await axios.get(`${process.env.MEDUSA_BACKEND_URL}/admin/variants/${variantId}/inventory`, {
      headers: {
        Authorization: `Bearer ${process.env.MEDUSA_ADMIN_API_KEY}`
      }
    });

    const inventory = response.data.variant;

    if (inventory.inventory?.length > 0) {
      const total = inventory.inventory.reduce((sum: number, item: any) => {
        return sum + (item.stocked_quantity || item.available_quantity || 0);
      }, 0);
      return total;
    }

    return 0;
  } catch (error) {
    return 0;
  }
}

async function syncPublishedProducts() {
  const algoliaService = new AlgoliaService(
    process.env.ALGOLIA_APP_ID!,
    process.env.ALGOLIA_ADMIN_API_KEY!,
    process.env.ALGOLIA_INDEX_NAME || "products",
  )

  try {
    const medusaUrl = process.env.MEDUSA_BACKEND_URL

    let publishedProducts
    try {
      const expandParams = [
        "variants",
        "variants.prices",
        "variants.inventory_items",
        "variants.inventory_items.inventory_levels",
        "inventory_items",
        "inventory_items.inventory_levels",
        "categories",
        "tags"
      ].join(",")

      const response = await axios.get(`${medusaUrl}/store/products`, {
        params: {
          expand: expandParams,
          limit: 1000,
        },
        timeout: 10000,
      })

      publishedProducts = response.data.products
    } catch (storeError) {
      if (process.env.MEDUSA_ADMIN_API_KEY) {
        const expandParams = [
          "variants",
          "variants.prices",
          "variants.inventory_items",
          "variants.inventory_items.inventory_levels",
          "inventory_items",
          "inventory_items.inventory_levels",
          "categories",
          "tags",
        ].join(",")

        const adminResponse = await axios.get(`${medusaUrl}/admin/products`, {
          headers: {
            Authorization: `Bearer ${process.env.MEDUSA_ADMIN_API_KEY}`,
            "Content-Type": "application/json",
          },
          params: {
            expand: expandParams,
            status: ["published"],
            limit: 1000,
          },
          timeout: 10000,
        })
        publishedProducts = adminResponse.data.products
      } else {
        throw storeError
      }
    }

    await algoliaService.initializeIndex()
    await algoliaService.clearIndex()
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const algoliaRecords: any[] = []

    for (const product of publishedProducts) {
      if (!product.variants || product.variants.length === 0) {
        const record = {
          objectID: `${product.id}_default`, // Use underscore to match AlgoliaService format
          id: `${product.id}_default`,
          product_id: product.id, // ✅ Added missing product_id
          variant_id: "default",
          product_title: product.title,
          variant_title: product.title,
          sku: product.handle || "",
          price: 0,
          currency_code: "inr",
          option_name: "",
          option_value: "",
          stocked_quantity: 0,
          created_at: product.created_at,
          updated_at: product.updated_at,
          status: "published",
          handle: product.handle || "", // ✅ Changed from product_handle to handle
          thumbnail: product.thumbnail || "", // ✅ Changed from product_thumbnail to thumbnail
          categories: product.categories?.map((cat: any) => cat.name || cat.title) || [],
          tags: product.tags?.map((tag: any) => tag.value || tag.name) || [],
        }
        algoliaRecords.push(record)
        continue
      }

      for (const variant of product.variants) {
        const primaryPrice = variant.prices?.[0] || null

        let option_name = ""
        let option_value = ""

        if (variant.options && variant.options.length > 0) {
          const firstOption = variant.options[0]
          option_name = firstOption.option?.title || firstOption.option_id || ""
          option_value = firstOption.value || ""
        }

        let variant_title = product.title
        if (option_value) {
          variant_title = `${product.title} - ${option_value}`
        }

        const stockedQuantity = await getVariantInventoryQuantity(variant.id);

        const record = {
          objectID: `${product.id}_${variant.id}`, // ✅ Use underscore format
          id: `${product.id}_${variant.id}`,
          product_id: product.id, // ✅ Added missing product_id
          variant_id: variant.id, // ✅ Added missing variant_id
          product_title: product.title,
          variant_title: variant_title,
          sku: variant.sku || "",
          price: primaryPrice?.amount || 0,
          currency_code: primaryPrice?.currency_code || "inr",
          option_name: option_name,
          option_value: option_value,
          stocked_quantity: stockedQuantity,
          created_at: product.created_at,
          updated_at: product.updated_at,
          status: "published",
          handle: product.handle || "", // ✅ Changed from product_handle to handle
          thumbnail: product.thumbnail || "", // ✅ Changed from product_thumbnail to thumbnail
          categories: product.categories?.map((cat: any) => cat.name || cat.title) || [],
          tags: product.tags?.map((tag: any) => tag.value || tag.name) || [],
          // Optional: Keep debug info but remove from production
          _inventory_debug: {
            variant_id: variant.id,
            api_response: `Fetched from /admin/variants/${variant.id}/inventory`
          },
        }

        algoliaRecords.push(record)
      }
    }

    console.log(`📤 Preparing to index ${algoliaRecords.length} records...`)
    
    // Log sample record to verify structure
    if (algoliaRecords.length > 0) {
      console.log('📋 Sample record structure:')
      const sample = algoliaRecords[0]
      console.log(`  - objectID: ${sample.objectID}`)
      console.log(`  - product_id: ${sample.product_id}`)
      console.log(`  - handle: ${sample.handle}`)
      console.log(`  - product_title: ${sample.product_title}`)
    }

    await algoliaService.indexAlgoliaRecords(algoliaRecords)
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const testResults = await algoliaService.search("", {}, 0, 1)

    console.log(`✅ Indexed ${testResults.nbHits} product variants to Algolia.`)
    
    // Test that product_id and handle are present
    if (testResults.hits.length > 0) {
      const firstHit = testResults.hits[0]
      console.log('🔍 First indexed record check:')
      console.log(`  - product_id: ${firstHit.product_id || 'MISSING!'}`)
      console.log(`  - handle: ${firstHit.handle || 'MISSING!'}`)
    }
    
  } catch (error) {
    console.error("❌ SYNC FAILED!")
    if (axios.isAxiosError(error)) {
      console.error("Connection error:", error.message)
      console.error("URL attempted:", error.config?.url)
      console.error("Status:", error.response?.status)
      console.error("Response:", JSON.stringify(error.response?.data, null, 2))
    } else {
      console.error("Error:", error)
    }
    process.exit(1)
  }
}

if (require.main === module) {
  const args = process.argv.slice(2)
  syncPublishedProducts()
}

export { syncPublishedProducts }