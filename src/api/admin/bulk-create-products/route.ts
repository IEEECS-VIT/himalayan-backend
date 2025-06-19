// src/api/admin/bulk-upload/route.ts

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createInventoryItemsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"
import multer from "multer"
import { parseCSVToProducts, validateCSVStructure } from "../../../utils/csv-parser"

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true)
    } else {
      cb(new Error("Only CSV files are allowed"))
    }
  },
})

const uploadMiddleware = upload.single("csv_file")

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    await new Promise<void>((resolve, reject) => {
      uploadMiddleware(req as any, res as any, (err) => {
        if (err) {
          console.error("Upload error:", err)
          reject(err)
        } else {
          resolve()
        }
      })
    })

    await handleBulkUpload(req, res)
  } catch (error) {
    console.error("POST error:", error)
    res.status(400).json({
      error: error.message || "File upload failed",
      details: error.toString(),
    })
  }
}

type InputType = {
  stock_loc_name: string
}

async function handleBulkUpload(req: MedusaRequest, res: MedusaResponse) {
  const container = req.scope
  const file = req.file
  const input: InputType = req.body as InputType
  console.log("Received input:", input)

  const stock_loc_name = input.stock_loc_name

  if (!file) {
    return res.status(400).json({
      error: "No CSV file provided. Please upload a CSV file.",
    })
  }

  // Get stock location name from request body
  if (!stock_loc_name) {
    return res.status(400).json({
      error: "Stock location name is required. Please provide stock_loc_name in the request body.",
    })
  }

  try {
    // Parse CSV file
    const products = await parseCSVToProducts(file.buffer)

    if (products.length === 0) {
      return res.status(400).json({
        error: "No valid products found in CSV file",
      })
    }

    // Validate CSV structure
    const validation = validateCSVStructure(products)
    if (!validation.isValid) {
      return res.status(400).json({
        error: "CSV validation failed",
        validation_errors: validation.errors,
      })
    }

    console.log(`Parsed ${products.length} products from CSV`)

    // 1. Fetch the stock location by name
    const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION)
    const stockLocations = await stockLocationModuleService.listStockLocations({
      name: [stock_loc_name],
    })

    if (stockLocations.length === 0) {
      return res.status(404).json({
        error: `Stock location '${stock_loc_name}' not found. Please check the stock location name.`,
      })
    }

    const stockLocation = stockLocations[0]
    console.log(`Using stock location: ${stockLocation.name} (ID: ${stockLocation.id})`)

    // 2. Fetch the shipping profile by name (matching stock location name)
    const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
    const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
      name: [stock_loc_name],
    })

    if (shippingProfiles.length === 0) {
      return res.status(404).json({
        error: `Shipping profile '${stock_loc_name}' not found. Please check the shipping profile name.`,
      })
    }

    const shippingProfile = shippingProfiles[0]
    console.log(`Using shipping profile: ${shippingProfile.name} (ID: ${shippingProfile.id})`)

    // 3. Handle collections and categories - find existing ones only
    const productModuleService = container.resolve(Modules.PRODUCT)

    // Get all unique collection and category names from CSV
    const collectionNames = [
      ...new Set(
        products
          .filter((p) => p.collection_name && p.collection_name.trim() !== "")
          .map((p) => p.collection_name ? p.collection_name.trim() : ""),
      ),
    ]

    const categoryNames = [
      ...new Set(
        products
          .filter((p) => typeof p.category_name === "string" && p.category_name && p.category_name.trim() !== "")
          .map((p) => (p.category_name ? p.category_name.trim() : "")),
      ),
    ]

    console.log("Collection names from CSV:", collectionNames)
    console.log("Category names from CSV:", categoryNames)

    // Fetch ALL existing collections and categories for case-insensitive matching
    const allExistingCollections = await productModuleService.listProductCollections({})
    const allExistingCategories = await productModuleService.listProductCategories({})

    console.log(
      "All existing collections:",
      allExistingCollections.map((c) => c.title),
    )
    console.log(
      "All existing categories:",
      allExistingCategories.map((c) => c.name),
    )

    // Create case-insensitive maps for collections and categories
    const collectionsMap = new Map<string, { id: string; originalName: string }>()
    const categoriesMap = new Map<string, { id: string; originalName: string }>()

    // Build collections map with case-insensitive keys
    allExistingCollections.forEach((collection) => {
      if (collection.title && typeof collection.title === "string") {
        const lowerCaseTitle = collection.title.toLowerCase()
        collectionsMap.set(lowerCaseTitle, {
          id: collection.id,
          originalName: collection.title,
        })
      }
    })

    // Build categories map with case-insensitive keys
    allExistingCategories.forEach((category) => {
      if (category.name && typeof category.name === "string") {
        const lowerCaseName = category.name.toLowerCase()
        categoriesMap.set(lowerCaseName, {
          id: category.id,
          originalName: category.name,
        })
      }
    })

    // Find missing collections and categories (case-insensitive with null checks)
    const missingCollections: string[] = []
    const foundCollections: Array<{ csvName: string; dbName: string; id: string }> = []

    collectionNames.forEach((collectionName) => {
      if (collectionName && typeof collectionName === "string") {
        const lowerCaseName = collectionName.toLowerCase()
        if (collectionsMap.has(lowerCaseName)) {
          const found = collectionsMap.get(lowerCaseName)!
          foundCollections.push({
            csvName: collectionName,
            dbName: found.originalName,
            id: found.id,
          })
        } else {
          missingCollections.push(collectionName)
        }
      }
    })

    const missingCategories: string[] = []
    const foundCategories: Array<{ csvName: string; dbName: string; id: string }> = []

    categoryNames.forEach((categoryName) => {
      if (categoryName && typeof categoryName === "string") {
        const lowerCaseName = categoryName.toLowerCase()
        if (categoriesMap.has(lowerCaseName)) {
          const found = categoriesMap.get(lowerCaseName)!
          foundCategories.push({
            csvName: categoryName,
            dbName: found.originalName,
            id: found.id,
          })
        } else {
          missingCategories.push(categoryName)
        }
      }
    })

    // Log findings
    if (foundCollections.length > 0) {
      console.log("✅ Found collections:")
      foundCollections.forEach((col) => {
        console.log(`  - CSV: "${col.csvName}" → DB: "${col.dbName}" (ID: ${col.id})`)
      })
    }

    if (foundCategories.length > 0) {
      console.log("✅ Found categories:")
      foundCategories.forEach((cat) => {
        console.log(`  - CSV: "${cat.csvName}" → DB: "${cat.dbName}" (ID: ${cat.id})`)
      })
    }

    if (missingCollections.length > 0) {
      console.warn("⚠️ Collections not found in database:", missingCollections)
    }

    if (missingCategories.length > 0) {
      console.warn("⚠️ Categories not found in database:", missingCategories)
    }

    // Create final lookup maps for product assignment
    const finalCollectionsMap = new Map<string, string>()
    const finalCategoriesMap = new Map<string, string>()

    foundCollections.forEach((col) => {
      finalCollectionsMap.set(col.csvName, col.id)
    })

    foundCategories.forEach((cat) => {
      finalCategoriesMap.set(cat.csvName, cat.id)
    })

    // 4. Check for existing inventory items and separate new vs existing
    const inventoryModuleService = container.resolve(Modules.INVENTORY)
    const allSkus = products.flatMap((product) => product.variants.map((variant) => variant.sku))

    // Get existing inventory items
    const existingInventoryItems = await inventoryModuleService.listInventoryItems({
      sku: allSkus,
    })

    const existingSkusMap = new Map(existingInventoryItems.map((item) => [item.sku, item]))

    console.log("Existing SKUs found:", Array.from(existingSkusMap.keys()))

    // Separate new and existing products
    type ProductVariant = {
      title: string
      sku: string
      prices: { amount: number; currency_code: string }[]
      options: Record<string, string>
      stocked_quantity: number
      inventory_item?: any
    }

    type ProductWithVariants = {
      title: string
      options: { title: string; values: string[] }[]
      variants: ProductVariant[]
      collection_name?: string
      category_name?: string
    }

    const newProducts: ProductWithVariants[] = []
    const existingProducts: ProductWithVariants[] = []

    for (const product of products) {
      const newVariants: ProductVariant[] = []
      const existingVariants: ProductVariant[] = []

      for (const variant of product.variants) {
        if (existingSkusMap.has(variant.sku)) {
          existingVariants.push({
            ...variant,
            inventory_item: existingSkusMap.get(variant.sku),
          })
        } else {
          newVariants.push(variant)
        }
      }

      if (newVariants.length > 0) {
        newProducts.push({
          ...product,
          variants: newVariants,
        })
      }

      if (existingVariants.length > 0) {
        existingProducts.push({
          ...product,
          variants: existingVariants,
        })
      }
    }

    console.log(`New products to create: ${newProducts.length}`)
    console.log(`Existing products to update: ${existingProducts.length}`)

    let createdProductsCount = 0
    let createdInventoryCount = 0
    let updatedInventoryCount = 0
    let updatedProductsCount = 0
    let collectionsAssigned = 0
    let categoriesAssigned = 0
    let collectionsSkipped = 0
    let categoriesSkipped = 0

    // 5. Create new products and inventory items
    if (newProducts.length > 0) {
      // Create inventory items for new variants
      const { result: inventoryResult } = await createInventoryItemsWorkflow(container).run({
        input: {
          items: newProducts.flatMap((product) =>
            product.variants.map((variant) => ({
              sku: variant.sku,
              title: variant.title,
              location_levels: [
                {
                  stocked_quantity: variant.stocked_quantity,
                  location_id: stockLocation.id,
                },
              ],
            })),
          ),
        },
      })

      // Link inventory items to variants
      let idx = 0
      const productsWithInventory = newProducts.map((product) => ({
        ...product,
        variants: product.variants.map((variant) => ({
          ...variant,
          inventory_items: [
            {
              inventory_item_id: inventoryResult[idx++].id,
            },
          ],
        })),
      }))

      // Create products with linked inventory items, collections, and categories
      const { result: productsResult } = await createProductsWorkflow(container).run({
        input: {
          products: productsWithInventory.map((product) => {
            const productData: any = {
              title: product.title,
              options: product.options,
              variants: product.variants.map((variant) => ({
                title: variant.title,
                sku: variant.sku,
                prices: variant.prices,
                options: variant.options,
                inventory_items: variant.inventory_items,
              })),
              shipping_profile_id: shippingProfile.id,
              sales_channels: [{ id: "sc_01JRRBTKHJ966F0TJ71F2GJR6P" }, { id: "sc_01JT2Q2X5WWCARJZTSPZMV4Z93" }],
            }

            // Add collection if it exists
            if (product.collection_name && finalCollectionsMap.has(product.collection_name)) {
              productData.collection_id = finalCollectionsMap.get(product.collection_name)
              collectionsAssigned++
              const foundCol = foundCollections.find((c) => c.csvName === product.collection_name)
              console.log(
                `✅ Assigned collection "${product.collection_name}" (DB: "${foundCol?.dbName}") to product "${product.title}"`,
              )
            } else if (product.collection_name) {
              collectionsSkipped++
              console.warn(
                `⚠️ Collection "${product.collection_name}" not found in database - skipping assignment for product "${product.title}"`,
              )
            }

            // Add categories if they exist
            if (product.category_name && finalCategoriesMap.has(product.category_name)) {
              productData.categories = [{ id: finalCategoriesMap.get(product.category_name) }]
              categoriesAssigned++
              const foundCat = foundCategories.find((c) => c.csvName === product.category_name)
              console.log(
                `✅ Assigned category "${product.category_name}" (DB: "${foundCat?.dbName}") to product "${product.title}"`,
              )
            } else if (product.category_name) {
              categoriesSkipped++
              console.warn(
                `⚠️ Category "${product.category_name}" not found in database - skipping assignment for product "${product.title}"`,
              )
            }

            return productData
          }),
        },
      })

      createdProductsCount = productsResult.length
      createdInventoryCount = inventoryResult.length
    }

    // 6. Update existing inventory levels and product variants
    if (existingProducts.length > 0) {
      console.log("Updating existing products...")

      for (const product of existingProducts) {
        console.log(`Updating product: ${product.title}`)

        // Handle collection and category updates for existing products
        try {
          const existingProductsByTitle = await productModuleService.listProducts({
            title: [product.title],
          })

          if (existingProductsByTitle.length > 0) {
            const existingProduct = existingProductsByTitle[0]
            const updateData: any = {}

            // Update collection if specified and exists
            if (product.collection_name && finalCollectionsMap.has(product.collection_name)) {
              updateData.collection_id = finalCollectionsMap.get(product.collection_name)
              collectionsAssigned++
              const foundCol = foundCollections.find((c) => c.csvName === product.collection_name)
              console.log(
                `✅ Updated collection "${product.collection_name}" (DB: "${foundCol?.dbName}") for existing product "${product.title}"`,
              )
            } else if (product.collection_name) {
              collectionsSkipped++
              console.warn(
                `⚠️ Collection "${product.collection_name}" not found in database - skipping update for existing product "${product.title}"`,
              )
            }

            // Update categories if specified and exists
            if (product.category_name && finalCategoriesMap.has(product.category_name)) {
              updateData.categories = [{ id: finalCategoriesMap.get(product.category_name) }]
              categoriesAssigned++
              const foundCat = foundCategories.find((c) => c.csvName === product.category_name)
              console.log(
                `✅ Updated category "${product.category_name}" (DB: "${foundCat?.dbName}") for existing product "${product.title}"`,
              )
            } else if (product.category_name) {
              categoriesSkipped++
              console.warn(
                `⚠️ Category "${product.category_name}" not found in database - skipping update for existing product "${product.title}"`,
              )
            }

            // Update product if there are changes
            if (Object.keys(updateData).length > 0) {
              await productModuleService.updateProducts(existingProduct.id, updateData)
              console.log(`✅ Updated product associations for "${product.title}"`)
            }
          }
        } catch (productUpdateError) {
          console.error(`❌ Failed to update product associations for "${product.title}":`, productUpdateError.message)
        }

        for (const variant of product.variants) {
          const inventoryItem = variant.inventory_item
          console.log(`Updating variant: ${variant.sku}`)

          try {
            // 1. Update inventory levels (stock quantity)
            const inventoryLevels = await inventoryModuleService.listInventoryLevels({
              inventory_item_id: [inventoryItem.id],
              location_id: [stockLocation.id],
            })

            if (inventoryLevels.length > 0) {
              await inventoryModuleService.updateInventoryLevels([
                {
                  inventory_item_id: inventoryItem.id,
                  location_id: stockLocation.id,
                  stocked_quantity: variant.stocked_quantity,
                },
              ])
              console.log(`✅ Updated inventory for ${variant.sku}: ${variant.stocked_quantity}`)
              updatedInventoryCount++
            } else {
              await inventoryModuleService.createInventoryLevels([
                {
                  inventory_item_id: inventoryItem.id,
                  location_id: stockLocation.id,
                  stocked_quantity: variant.stocked_quantity,
                },
              ])
              console.log(`✅ Created inventory level for ${variant.sku}: ${variant.stocked_quantity}`)
              updatedInventoryCount++
            }

            // 2. Update product variant (title, options, etc.)
            try {
              const existingProductVariants = await productModuleService.listProductVariants({
                sku: [variant.sku],
              })

              if (existingProductVariants.length > 0) {
                const existingVariant = existingProductVariants[0]

                // Use the updateProductVariantsWorkflow instead of direct service call
                await updateProductVariantsWorkflow(container).run({
                  input: {
                    selector: { id: existingVariant.id },
                    update: {
                      title: variant.title,
                      options: variant.options,
                    },
                  },
                })

                console.log(`✅ Updated product variant ${variant.sku}`)
                updatedProductsCount++

                // 3. Update prices separately using pricing module
                try {
                  const pricingModuleService = container.resolve(Modules.PRICING)

                  // Get existing price sets for this variant
                  const priceSets = await pricingModuleService.listPriceSets({
                    id: [existingVariant.id],
                  })

                  if (priceSets.length > 0 && variant.prices.length > 0) {
                    const priceSetId = priceSets[0].id

                    // Update prices in the price set
                    await pricingModuleService.updatePriceSets(priceSetId, {
                      prices: variant.prices.map((price) => ({
                        amount: price.amount,
                        currency_code: price.currency_code,
                      })),
                    })

                    console.log(`✅ Updated prices for ${variant.sku}`)
                  } else {
                    // If no price set exists, create a new price set with prices
                    if (variant.prices.length > 0) {
                      await pricingModuleService.createPriceSets({
                        prices: variant.prices.map((price) => ({
                          amount: price.amount,
                          currency_code: price.currency_code,
                        })),
                      })
                      console.log(`✅ Created price set for ${variant.sku}`)
                    }
                  }
                } catch (priceError) {
                  console.log(`⚠️ Price update failed for ${variant.sku}:`, priceError.message)
                  // Don't fail the whole process for price errors
                }
              } else {
                console.log(`⚠️ Product variant not found for SKU: ${variant.sku}`)
              }
            } catch (variantError) {
              console.error(`❌ Failed to update product variant ${variant.sku}:`, variantError.message)
            }
          } catch (updateError) {
            console.error(`❌ Failed to update variant ${variant.sku}:`, updateError.message)
          }
        }
      }

      console.log(`Update summary: ${updatedProductsCount} products, ${updatedInventoryCount} inventory items`)
    }

    res.status(200).json({
      message: "Successfully processed CSV upload with updates",
      created: {
        products: createdProductsCount,
        inventory_items: createdInventoryCount,
      },
      updated: {
        products: updatedProductsCount,
        inventory_items: updatedInventoryCount,
      },
      associations: {
        collections_assigned: collectionsAssigned,
        categories_assigned: categoriesAssigned,
        collections_skipped: collectionsSkipped,
        categories_skipped: categoriesSkipped,
        found_collections: foundCollections.map((c) => ({
          csv_name: c.csvName,
          db_name: c.dbName,
        })),
        found_categories: foundCategories.map((c) => ({
          csv_name: c.csvName,
          db_name: c.dbName,
        })),
        missing_collections: missingCollections,
        missing_categories: missingCategories,
      },
      stockLocation: stockLocation.name,
      shippingProfile: shippingProfile.name,
      summary: {
        total_products_in_csv: products.length,
        new_products_created: newProducts.length,
        existing_products_updated: existingProducts.length,
        total_operations: createdProductsCount + updatedProductsCount,
        inventory_updates: updatedInventoryCount,
        variant_updates: updatedProductsCount,
        collections_processed: collectionNames.length,
        categories_processed: categoryNames.length,
      },
    })
  } catch (error) {
    console.error("Bulk upload error:", error)
    res.status(500).json({
      error: "Failed to process CSV file",
      details: error.message,
    })
  }
}