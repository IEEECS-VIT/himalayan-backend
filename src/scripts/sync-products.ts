// sync-published-products.ts
import dotenv from "dotenv"
dotenv.config() // 👈 This must come first!

import { AlgoliaService } from "../services/algolia.service"
import axios from "axios"

// Improved inventory quantity extraction
// Replace getVariantInventoryQuantity with this more reliable version
async function getVariantInventoryQuantity(variantId: string): Promise<number> {
  try {
    console.log(`\n🔄 Fetching inventory directly for variant ${variantId}`);
    
    // Make direct API call to inventory endpoint
    const response = await axios.get(`${process.env.MEDUSA_BACKEND_URL}/admin/variants/${variantId}/inventory`, {
      headers: {
        Authorization: `Bearer ${process.env.MEDUSA_ADMIN_API_KEY}`
      }
    });

    const inventory = response.data.variant;
    console.log("Raw inventory response:", JSON.stringify(inventory, null, 2));

    // Extract quantity from the direct inventory response
    if (inventory.inventory?.length > 0) {
      const total = inventory.inventory.reduce((sum: number, item: any) => {
        return sum + (item.stocked_quantity || item.available_quantity || 0);
      }, 0);
      console.log(`✅ Found inventory: ${total}`);
      return total;
    }

    console.log("❌ No inventory data in direct response");
    return 0;
  } catch (error) {
    console.error("Failed to fetch inventory:", error.response?.data || error.message);
    return 0;
  }
}

// Enhanced debugging function
function debugVariantInventoryStructure(variant: any) {
  console.log(`\n🔍 DETAILED INVENTORY DEBUG for variant ${variant.id}:`)
  console.log(`manage_inventory: ${variant.manage_inventory}`)
  console.log(`allow_backorder: ${variant.allow_backorder}`)
  
  // Show all quantity-related fields
  Object.keys(variant).forEach(key => {
    if (key.toLowerCase().includes('inventory') || 
        key.toLowerCase().includes('stock') || 
        key.toLowerCase().includes('quantity')) {
      console.log(`${key}:`, JSON.stringify(variant[key], null, 2))
    }
  })
  
  // Deep dive into inventory_items
  if (variant.inventory_items) {
    console.log('\nInventory Items Structure:')
    variant.inventory_items.forEach((item: any, i: number) => {
      console.log(`  Item ${i}:`, JSON.stringify(item, null, 2))
    })
  }
}

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

    // Step 2: Get your published products from Medusa with EXPANDED inventory data
    console.log("\n📦 Fetching published products from your Medusa store...")

    let publishedProducts
    try {
      // FIXED: Improved expand parameters for better inventory data
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

      console.log("🔍 Using expand parameters:", expandParams)

      // Try store API first (public, published products only)
      const response = await axios.get(`${medusaUrl}/store/products`, {
        params: {
          expand: expandParams,
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
        console.log(`✅ Found ${publishedProducts.length} published products using admin API`)
      } else {
        console.error("❌ Both store and admin API failed")
        throw storeError
      }
    }

    // Add this debugging code right after fetching publishedProducts
    console.log("\n🧪 RAW INVENTORY DATA TEST:")
    if (publishedProducts.length > 0) {
      const testProduct = publishedProducts[0]
      if (testProduct.variants && testProduct.variants.length > 0) {
        const testVariant = testProduct.variants[0]
        console.log("Full variant object:", JSON.stringify(testVariant, null, 2))
      }
    }

    // Step 3: Debug the actual product structure - ENHANCED
    console.log("\n🔍 DEBUGGING PRODUCT STRUCTURE:")
    if (publishedProducts.length > 0) {
      const sampleProduct = publishedProducts[0]
      console.log("Sample product keys:", Object.keys(sampleProduct))
      console.log("Sample product:", JSON.stringify(sampleProduct, null, 2).slice(0, 1000) + "...")

      if (sampleProduct.variants && sampleProduct.variants.length > 0) {
        const sampleVariant = sampleProduct.variants[0]
        console.log("Sample variant keys:", Object.keys(sampleVariant))
        console.log("Sample variant:", JSON.stringify(sampleVariant, null, 2).slice(0, 1000) + "...")

        // ENHANCED: Debug inventory fields specifically
        console.log("\n🔍 INVENTORY DEBUGGING:")
        console.log("variant.inventory_quantity:", sampleVariant.inventory_quantity)
        console.log("variant.quantity:", sampleVariant.quantity)
        console.log("variant.stock_quantity:", sampleVariant.stock_quantity)
        console.log("variant.manage_inventory:", sampleVariant.manage_inventory)
        console.log("variant.allow_backorder:", sampleVariant.allow_backorder)
        console.log("variant.inventory_items:", sampleVariant.inventory_items)
        console.log("variant.inventory:", sampleVariant.inventory)

        // Check all possible inventory-related fields
        Object.keys(sampleVariant).forEach((key) => {
          if (
            key.toLowerCase().includes("inventory") ||
            key.toLowerCase().includes("stock") ||
            key.toLowerCase().includes("quantity")
          ) {
            console.log(`Found inventory-related field '${key}':`, sampleVariant[key])
          }
        })
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

    // Step 6: Transform and index products (UPDATED VERSION with improved inventory handling)
    console.log("📤 Transforming and indexing products to Algolia...")

    // Transform each product into individual variant records matching your CSV format
    const algoliaRecords: any[] = []

    for (const product of publishedProducts) {
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
        continue
      }

      // Updated variant processing with improved inventory extraction
      for (const variant of product.variants) {
        // Debug the variant structure for the first variant
        if (variant === product.variants[0]) {
          debugVariantInventoryStructure(variant)
        }

        // Get the primary price
        const primaryPrice = variant.prices?.[0] || null

        // Extract option information (Size, Color, etc.)
        let option_name = ""
        let option_value = ""

        if (variant.options && variant.options.length > 0) {
          const firstOption = variant.options[0]
          option_name = firstOption.option?.title || firstOption.option_id || ""
          option_value = firstOption.value || ""
        }

        // Build variant title
        let variant_title = product.title
        if (option_value) {
          variant_title = `${product.title} - ${option_value}`
        }

        // Use the improved inventory extraction
        const stockedQuantity = await getVariantInventoryQuantity(variant.id);

     
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
          stocked_quantity: stockedQuantity, // Using improved extraction
          _inventory_debug: {
    variant_id: variant.id,
    api_response: `Fetched from /admin/variants/${variant.id}/inventory`
  },

          // Additional useful fields for search/filtering
          in_stock: stockedQuantity > 0,
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
      }
    }

    console.log(`\n📊 Created ${algoliaRecords.length} Algolia records from ${publishedProducts.length} products`)

    // Debug: Show sample transformed record
    if (algoliaRecords.length > 0) {
      console.log("\n🔍 Sample Algolia record:")
      console.log(JSON.stringify(algoliaRecords[0], null, 2))
    }

    // Index to Algolia
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
        console.log(
          `  ${index + 1}. ${hit.product_title} - ${hit.variant_title} (${price}, Stock: ${hit.stocked_quantity})`,
        )
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
          console.log(`  ${i + 1}. ${hit.product_title} - ${hit.variant_title} (Stock: ${hit.stocked_quantity})`)
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

    // Test store products endpoint with inventory expansion
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

    const storeProducts = await axios.get(`${medusaUrl}/store/products?limit=1&expand=${expandParams}`)
    console.log(`✅ Store products endpoint accessible (${storeProducts.data.products?.length || 0} products)`)

    if (storeProducts.data.products && storeProducts.data.products.length > 0) {
      console.log("Sample product structure:")
      const product = storeProducts.data.products[0]
      console.log("Product keys:", Object.keys(product))

      if (product.variants && product.variants.length > 0) {
        console.log("Variant keys:", Object.keys(product.variants[0]))
        console.log("Sample variant inventory data:")
        const variant = product.variants[0]
        Object.keys(variant).forEach((key) => {
          if (
            key.toLowerCase().includes("inventory") ||
            key.toLowerCase().includes("stock") ||
            key.toLowerCase().includes("quantity")
          ) {
            console.log(`  ${key}:`, variant[key])
          }
        })
      }
    }

    // If admin key is available, test admin endpoint
    if (process.env.MEDUSA_ADMIN_API_KEY) {
      const adminProducts = await axios.get(`${medusaUrl}/admin/products?limit=1&expand=${expandParams}`, {
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