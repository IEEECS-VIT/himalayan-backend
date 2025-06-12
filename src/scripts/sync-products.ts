// sync-published-products.ts
import dotenv from "dotenv"
dotenv.config() // 👈 This must come first!

import { AlgoliaService } from "../services/algolia.service"
import axios from "axios"

async function syncPublishedProducts() {
  console.log("=== SYNCING YOUR PUBLISHED MEDUSA PRODUCTS ===")

  // Debug environment variables
  console.log("\n🔍 Environment Check:")
  console.log("ALGOLIA_APP_ID:", process.env.ALGOLIA_APP_ID ? "✅ SET" : "❌ NOT SET")
  console.log("ALGOLIA_ADMIN_API_KEY:", process.env.ALGOLIA_ADMIN_API_KEY ? "✅ SET" : "❌ NOT SET")
  console.log("ALGOLIA_INDEX_NAME:", process.env.ALGOLIA_INDEX_NAME || "products (default)")
  console.log("MEDUSA_BACKEND_URL:", process.env.MEDUSA_BACKEND_URL || "http://localhost:9000 (default)")

  const algoliaService = new AlgoliaService(
    process.env.ALGOLIA_APP_ID!,
    process.env.ALGOLIA_ADMIN_API_KEY!,
    process.env.ALGOLIA_INDEX_NAME || "products",
  )

  try {
    // Step 1: Test Medusa backend connectivity
    const medusaUrl = process.env.MEDUSA_BACKEND_URL
    console.log(`\n🔌 Testing connection to Medusa backend: ${medusaUrl}`)

    try {
      const healthCheck = await axios.get(`${medusaUrl}/health`, { timeout: 5000 })
      console.log("✅ Medusa backend is accessible")
    } catch (error) {
      console.error("❌ Cannot connect to Medusa backend!")
      console.error("Make sure your Medusa backend is running at:", medusaUrl)
      if (axios.isAxiosError(error)) {
        console.error("Error:", error.message)
      }
      throw new Error("Medusa backend not accessible")
    }

    // Step 2: Get your published products from Medusa
    console.log("\n📦 Fetching published products from your Medusa store...")

    let publishedProducts
    try {
      // Try store API first (public, published products only)
      const response = await axios.get(`${medusaUrl}/store/products`, {
        params: {
          expand: "variants,variants.prices,categories,tags",
          limit: 1000,
        },
        timeout: 10000,
      })

      publishedProducts = response.data.products
      console.log(`✅ Found ${publishedProducts.length} published products using store API`)
    } catch (storeError) {
      console.log("⚠️ Store API failed, trying admin API...")

      // Fallback to admin API if available
      if (process.env.MEDUSA_ADMIN_API_KEY) {
        const adminResponse = await axios.get(`${medusaUrl}/admin/products`, {
          headers: {
            Authorization: `Bearer ${process.env.MEDUSA_ADMIN_API_KEY}`,
            "Content-Type": "application/json",
          },
          params: {
            expand: "variants,variants.prices,categories,tags",
            status: ["published"],
            limit: 1000,
          },
          timeout: 10000,
        })
        publishedProducts = adminResponse.data.products
        console.log(`✅ Found ${publishedProducts.length} published products using admin API`)
      } else {
        console.error("❌ Both store and admin API failed")
        throw storeError
      }
    }

    // Step 3: Debug the actual product structure
    console.log("\n🔍 DEBUGGING PRODUCT STRUCTURE:")
    if (publishedProducts.length > 0) {
      const sampleProduct = publishedProducts[0]
      console.log("Sample product keys:", Object.keys(sampleProduct))
      console.log("Sample product:", JSON.stringify(sampleProduct, null, 2).slice(0, 1000) + "...")

      if (sampleProduct.variants && sampleProduct.variants.length > 0) {
        console.log("Sample variant keys:", Object.keys(sampleProduct.variants[0]))
        console.log("Sample variant:", JSON.stringify(sampleProduct.variants[0], null, 2).slice(0, 500) + "...")
      }
    }

    // Step 4: Show what products we found
    console.log("\n📋 Products found:")
    publishedProducts.forEach((product: any, index: number) => {
      const variantCount = product.variants?.length || 0
      const price = product.variants?.[0]?.prices?.[0]?.amount
        ? `₹${product.variants[0].prices[0].amount / 100}`
        : "No price"
      console.log(`  ${index + 1}. ${product.title} (${variantCount} variants, ${price})`)
    })

    // Step 5: Prepare Algolia
    console.log("\n🔧 Preparing Algolia index...")
    await algoliaService.initializeIndex()
    console.log("⏳ Clearing existing data...")
    await algoliaService.clearIndex()

    // Wait for index to be cleared
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Step 6: Transform and index products (FIXED VERSION)
    console.log("📤 Transforming and indexing products to Algolia...")

    // Transform each product into individual variant records matching your CSV format
    const algoliaRecords: any[] = []

    publishedProducts.forEach((product: any) => {
      if (!product.variants || product.variants.length === 0) {
        console.log(`⚠️ Product ${product.title} has no variants, creating default variant`)

        // Create a default variant if none exists
        const record = {
          objectID: `${product.id}-default`,
          product_title: product.title,
          variant_title: product.title, // Use product title as variant title
          sku: product.handle || "",
          price: 0, // No price available
          currency_code: "inr",
          option_name: "",
          option_value: "",
          stocked_quantity: 0,
          // Additional fields for filtering
          in_stock: false,
          category: product.categories?.[0]?.name || "",
          categories: product.categories?.map((cat: any) => cat.name || cat.title) || [],
          tags: product.tags?.map((tag: any) => tag.value || tag.name) || [],
          product_handle: product.handle,
          product_thumbnail: product.thumbnail || "",
          status: "published",
          created_at: product.created_at,
          updated_at: product.updated_at,
        }
        algoliaRecords.push(record)
        return
      }

      product.variants.forEach((variant: any) => {
        // Get the primary price
        const primaryPrice = variant.prices?.[0] || null

        // Extract option information (Size, Color, etc.)
        let option_name = ""
        let option_value = ""

        if (variant.options && variant.options.length > 0) {
          // Take the first option (most common case)
          const firstOption = variant.options[0]
          option_name = firstOption.option?.title || firstOption.option_id || ""
          option_value = firstOption.value || ""
        }

        // Build variant title (product + options)
        let variant_title = product.title
        if (option_value) {
          variant_title = `${product.title} - ${option_value}`
        }

        // Create record matching your CSV format exactly
        const record = {
          objectID: `${product.id}-${variant.id}`,

          // CSV format fields (matching your expected structure)
          product_title: product.title,
          variant_title: variant_title,
          sku: variant.sku || "",
          price: primaryPrice?.amount || 0,
          currency_code: primaryPrice?.currency_code || "inr",
          option_name: option_name,
          option_value: option_value,
          stocked_quantity: variant.inventory_quantity || 0,

          // Additional useful fields for search/filtering
          in_stock: (variant.inventory_quantity || 0) > 0,
          category: product.categories?.[0]?.name || product.categories?.[0]?.title || "",
          categories: product.categories?.map((cat: any) => cat.name || cat.title) || [],
          tags: product.tags?.map((tag: any) => tag.value || tag.name) || [],
          product_handle: product.handle,
          product_thumbnail: product.thumbnail || "",
          status: "published",
          created_at: product.created_at,
          updated_at: product.updated_at,
        }

        algoliaRecords.push(record)

        // Log the transformation for debugging
        console.log(
          `✅ Transformed: ${record.product_title} -> ${record.variant_title} (₹${record.price / 100}, ${record.stocked_quantity} in stock)`,
        )
      })
    })

    console.log(`\n📊 Created ${algoliaRecords.length} Algolia records from ${publishedProducts.length} products`)

    // Debug: Show sample transformed record
    if (algoliaRecords.length > 0) {
      console.log("\n🔍 Sample Algolia record:")
      console.log(JSON.stringify(algoliaRecords[0], null, 2))
    }

    // 🔥 FIX: Use the new indexAlgoliaRecords method instead of indexProducts
    await algoliaService.indexAlgoliaRecords(algoliaRecords)

    // Step 7: Verify the sync worked
    console.log("\n⏳ Waiting for indexing to complete...")
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const testResults = await algoliaService.search("", {}, 0, 5)

    console.log("\n🎉 SYNC COMPLETED!")
    console.log(`✅ Successfully indexed ${testResults.nbHits} product variants`)
    console.log("✅ Your Medusa products are now searchable!")

    if (testResults.hits.length > 0) {
      console.log("\n🔍 Sample searchable products:")
      testResults.hits.forEach((hit, index) => {
        const price = hit.price ? `₹${hit.price / 100}` : "No price"
        console.log(`  ${index + 1}. ${hit.product_title} - ${hit.variant_title} (${price})`)
      })
    }

    console.log("\n🚀 You can now test your search API:")
    console.log("   GET /api/admin/search?query=")
    console.log("   GET /api/admin/search?query=your-product-name")

    // Step 8: Test a sample search
    if (publishedProducts.length > 0) {
      const firstProductTitle = publishedProducts[0].title
      console.log(`\n🧪 Testing search for "${firstProductTitle}"...`)
      const searchTest = await algoliaService.search(firstProductTitle, {}, 0, 3)
      console.log(`Search test result: ${searchTest.nbHits} hits found`)

      if (searchTest.hits.length > 0) {
        console.log("Search results:")
        searchTest.hits.forEach((hit, i) => {
          console.log(`  ${i + 1}. ${hit.product_title} - ${hit.variant_title}`)
        })
      }
    }
  } catch (error) {
    console.error("\n❌ SYNC FAILED!")

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

// Diagnostic function to check your Medusa setup
async function diagnoseMedusaSetup() {
  const medusaUrl = process.env.MEDUSA_BACKEND_URL

  console.log("=== MEDUSA SETUP DIAGNOSTIC ===")
  console.log("Backend URL:", medusaUrl)

  try {
    // Test health endpoint
    const health = await axios.get(`${medusaUrl}/health`)
    console.log("✅ Health check passed")

    // Test store products endpoint
    const storeProducts = await axios.get(`${medusaUrl}/store/products?limit=1&expand=variants,variants.prices`)
    console.log(`✅ Store products endpoint accessible (${storeProducts.data.products?.length || 0} products)`)

    if (storeProducts.data.products && storeProducts.data.products.length > 0) {
      console.log("Sample product structure:")
      console.log(JSON.stringify(storeProducts.data.products[0], null, 2))
    }

    // If admin key is available, test admin endpoint
    if (process.env.MEDUSA_ADMIN_API_KEY) {
      const adminProducts = await axios.get(`${medusaUrl}/admin/products?limit=1&expand=variants,variants.prices`, {
        headers: {
          Authorization: `Bearer ${process.env.MEDUSA_ADMIN_API_KEY}`,
        },
      })
      console.log(`✅ Admin products endpoint accessible (${adminProducts.data.products?.length || 0} products)`)
    }
  } catch (error) {
    console.error("❌ Diagnostic failed:")
    if (axios.isAxiosError(error)) {
      console.error("Error:", error.message)
      console.error("Status:", error.response?.status)
      console.error("Response:", error.response?.data)
    } else {
      console.error("Error:", error)
    }
  }
}

// Run the sync
if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.includes("--diagnose")) {
    diagnoseMedusaSetup()
  } else {
    syncPublishedProducts()
  }
}

export { syncPublishedProducts, diagnoseMedusaSetup }
