import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

type InventoryOperation = {
  variant_id: string
  quantity: number
  location_id?: string
  sku?: string
  operation: "update" | "delete" | "set_location"
  allow_backorder?: boolean
  manage_inventory?: boolean
}

type BulkInventoryInput = {
  operations: InventoryOperation[]
  default_location_id?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { operations, default_location_id } = req.body as BulkInventoryInput

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({
        type: "invalid_data",
        message: "Operations array is required",
      })
    }

    console.log("Processing inventory operations:", JSON.stringify(operations, null, 2))

    const results = {
      processed: 0,
      errors: [] as string[],
      success: [] as string[],
      warnings: [] as string[],
    }

    // Get services
    const inventoryService = req.scope.resolve("inventory")
    const productService = req.scope.resolve("product")
    const stockLocationService = await getStockLocationService(req.scope)

    if (!inventoryService) {
      return res.status(500).json({
        type: "service_error",
        message: "Inventory service not available",
      })
    }

    if (!productService) {
      return res.status(500).json({
        type: "service_error",
        message: "Product service not available",
      })
    }

    const defaultLocation = default_location_id || "default-location"
    console.log(`Using default location: ${defaultLocation}`)

    for (const operation of operations) {
      try {
        const locationId = operation.location_id || defaultLocation

        // Verify variant exists
        try {
          const variants = await productService.listProductVariants({ id: [operation.variant_id] })
          if (!variants || variants.length === 0) {
            results.errors.push(`Variant ${operation.variant_id} not found`)
            continue
          }
        } catch (error) {
          try {
            await productService.retrieveProductVariant(operation.variant_id)
          } catch (error2) {
            results.errors.push(`Variant ${operation.variant_id} not found`)
            continue
          }
        }

        switch (operation.operation) {
          case "update":
          case "set_location":
            await updateOrSetInventoryForVariant(inventoryService, stockLocationService, operation, locationId)
            results.success.push(`Updated inventory for variant ${operation.variant_id} at location ${locationId}`)
            break

          case "delete":
            await deleteInventoryForVariant(inventoryService, operation.variant_id)
            results.success.push(`Deleted inventory for variant ${operation.variant_id}`)
            break

          default:
            results.errors.push(`Unknown operation: ${operation.operation}. Use 'update', 'set_location', or 'delete'`)
            continue
        }

        results.processed++
      } catch (error) {
        console.error(`Error processing operation for variant ${operation.variant_id}:`, error)
        results.errors.push(`Failed ${operation.operation} for variant ${operation.variant_id}: ${error.message}`)
      }
    }

    return res.status(200).json({
      success: true,
      results,
      summary: {
        total_operations: operations.length,
        successful: results.processed,
        failed: results.errors.length,
      },
    })
  } catch (error) {
    console.error("Bulk inventory error:", error)
    return res.status(500).json({
      type: "inventory_error",
      message: error?.message || "Failed to process inventory operations",
      details: process.env.NODE_ENV === "development" ? error?.stack : undefined,
    })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const availableServices: string[] = []
    const commonServiceNames = [
      "inventoryService",
      "inventoryModuleService",
      "inventory",
      "@medusajs/inventory",
      "stockLocationService",
      "stockLocationModuleService",
      "stockLocation",
      "@medusajs/stock-location",
      "productService",
      "productModuleService",
      "product",
      "@medusajs/product",
      "productVariantService",
      "query",
      "manager",
    ]

    for (const serviceName of commonServiceNames) {
      try {
        const service = req.scope.resolve(serviceName)
        if (service) {
          availableServices.push(serviceName)
        }
      } catch (error) {
        // Service not available
      }
    }

    // Get available locations
    const stockLocationService = await getStockLocationService(req.scope)
    type Location = { id: string; name?: string; address?: any }
    let locations: Location[] = []

    if (stockLocationService) {
      try {
        const result = await stockLocationService.list({})
        locations = Array.isArray(result) ? result : result?.data || []
      } catch (error) {
        console.log("Could not fetch locations:", error.message)
      }
    }

    return res.status(200).json({
      message: "Inventory Management API - For updating existing product inventory",
      debug: {
        available_services: availableServices,
        inventory_service_available: !!(await getInventoryService(req.scope)),
        stock_location_service_available: !!(await getStockLocationService(req.scope)),
        product_service_available: !!(await getProductVariantService(req.scope)),
      },
      available_locations: locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        address: loc.address,
      })),
      operations: {
        POST: "Update inventory for existing variants",
        supported_operations: ["update", "set_location", "delete"],
        note: "This API works with existing inventory items created by the batch products workflow",
      },
      example_request: {
        operations: [
          {
            variant_id: "variant_123",
            quantity: 100,
            operation: "update",
            sku: "PROD-001",
            location_id: "default-location",
          },
        ],
      },
    })
  } catch (error) {
    return res.status(200).json({
      message: "Inventory Management API",
      error: "Could not fetch location data",
    })
  }
}

// Helper functions
async function getInventoryService(scope: any) {
  const serviceNames = ["inventoryModuleService", "inventory", "@medusajs/inventory", "inventoryService"]

  for (const serviceName of serviceNames) {
    try {
      const service = scope.resolve(serviceName)
      if (service && typeof service === "object") {
        console.log(`Successfully resolved inventory service: ${serviceName}`)
        return service
      }
    } catch (error) {
      console.log(`Failed to resolve ${serviceName}:`, error.message)
    }
  }

  return null
}

async function getStockLocationService(scope: any) {
  const serviceNames = [
    "stockLocationModuleService",
    "stockLocation",
    "@medusajs/stock-location",
    "stockLocationService",
  ]

  for (const serviceName of serviceNames) {
    try {
      const service = scope.resolve(serviceName)
      if (service && typeof service === "object") {
        console.log(`Successfully resolved stock location service: ${serviceName}`)
        return service
      }
    } catch (error) {
      console.log(`Failed to resolve ${serviceName}:`, error.message)
    }
  }

  return null
}

async function getProductVariantService(scope: any) {
  const serviceNames = [
    "productModuleService",
    "product",
    "@medusajs/product",
    "productVariantService",
    "productService",
  ]

  for (const serviceName of serviceNames) {
    try {
      const service = scope.resolve(serviceName)
      if (service && typeof service === "object") {
        console.log(`Successfully resolved product service: ${serviceName}`)
        return service
      }
    } catch (error) {
      console.log(`Failed to resolve ${serviceName}:`, error.message)
    }
  }

  return null
}

async function findInventoryItemBySku(inventoryService: any, sku: string) {
  console.log(`Searching for inventory item with SKU: ${sku}`)

  try {
    let result
    if (inventoryService.listInventoryItems) {
      result = await inventoryService.listInventoryItems({ sku })
    } else if (inventoryService.list) {
      result = await inventoryService.list({ sku })
    } else {
      throw new Error("No method available to list inventory items")
    }

    const items = Array.isArray(result) ? result : result?.data || result?.inventory_items || []
    console.log(`Found ${items.length} inventory items with SKU ${sku}`)

    return items.length > 0 ? items[0] : null
  } catch (error) {
    console.error(`Error finding inventory item by SKU ${sku}:`, error)
    return null
  }
}

async function findInventoryItemByVariantId(inventoryService: any, variantId: string) {
  console.log(`Searching for inventory item with variant_id: ${variantId}`)

  try {
    let result
    if (inventoryService.listInventoryItems) {
      result = await inventoryService.listInventoryItems({})
    } else if (inventoryService.list) {
      result = await inventoryService.list({})
    } else {
      throw new Error("No method available to list inventory items")
    }

    const allItems = Array.isArray(result) ? result : result?.data || result?.inventory_items || []

    // Filter by variant_id in metadata or direct property
    const items = allItems.filter(
      (item) => item.variant_id === variantId || (item.metadata && item.metadata.variant_id === variantId),
    )

    console.log(`Found ${items.length} inventory items for variant ${variantId}`)

    return items.length > 0 ? items[0] : null
  } catch (error) {
    console.error(`Error finding inventory item by variant_id ${variantId}:`, error)
    return null
  }
}

async function ensureStockLocationExists(stockLocationService: any, locationId: string) {
  if (!stockLocationService) {
    console.log("Stock location service not available, assuming location exists")
    return true
  }

  try {
    if (stockLocationService.retrieve) {
      await stockLocationService.retrieve(locationId)
      console.log(`Stock location ${locationId} exists`)
      return true
    } else if (stockLocationService.list) {
      const result = await stockLocationService.list({ id: locationId })
      const locations = Array.isArray(result) ? result : result?.data || []
      if (locations.length > 0) {
        console.log(`Stock location ${locationId} exists`)
        return true
      }
    }

    console.log(`Stock location ${locationId} not found`)
    return false
  } catch (error) {
    console.log(`Could not verify stock location ${locationId}: ${error.message}`)
    return false // Assume it doesn't exist
  }
}

async function updateOrSetInventoryForVariant(
  inventoryService: any,
  stockLocationService: any,
  operation: InventoryOperation,
  locationId: string,
) {
  console.log(`Updating/setting inventory for variant ${operation.variant_id} at location ${locationId}`)

  try {
    // First, find the existing inventory item
    let inventoryItem: any = null

    if (operation.sku) {
      inventoryItem = await findInventoryItemBySku(inventoryService, operation.sku)
    }

    if (!inventoryItem) {
      inventoryItem = await findInventoryItemByVariantId(inventoryService, operation.variant_id)
    }

    if (!inventoryItem) {
      throw new Error(
        `No inventory item found for variant ${operation.variant_id}. The product may not have been created properly.`,
      )
    }

    console.log(`Found inventory item: ${inventoryItem.id}`)

    // Ensure the stock location exists
    const locationExists = await ensureStockLocationExists(stockLocationService, locationId)
    if (!locationExists) {
      console.log(`Warning: Stock location ${locationId} may not exist, but proceeding anyway`)
    }

    // Now handle the inventory level for this location
    try {
      type InventoryLevel = { id: string; [key: string]: any }
      let existingLevel: InventoryLevel | null = null

      // Try to find existing inventory level for this item at this location
      if (inventoryService.listInventoryLevels) {
        try {
          const levelsResult = await inventoryService.listInventoryLevels({
            inventory_item_id: inventoryItem.id,
            location_id: locationId,
          })
          const levels: InventoryLevel[] = Array.isArray(levelsResult) ? levelsResult : levelsResult?.data || []
          existingLevel = levels.length > 0 ? levels[0] : null
          console.log(`Found ${levels.length} existing inventory levels for this item at location ${locationId}`)
        } catch (error) {
          console.log(`Could not list inventory levels: ${error.message}`)
        }
      }

      if (existingLevel) {
        // Update existing inventory level
        console.log(`Updating existing inventory level: ${existingLevel.id}`)

        if (inventoryService.updateInventoryLevel) {
          await inventoryService.updateInventoryLevel(existingLevel.id, {
            stocked_quantity: operation.quantity,
          })
          console.log(`Updated inventory level ${existingLevel.id} with quantity ${operation.quantity}`)
        } else if (inventoryService.updateInventoryLevels) {
          await inventoryService.updateInventoryLevels([
            {
              id: existingLevel.id,
              stocked_quantity: operation.quantity,
            },
          ])
          console.log(`Updated inventory level via batch update`)
        } else {
          throw new Error("No method available to update inventory levels")
        }
      } else {
        // Create new inventory level for this location
        console.log(`Creating new inventory level for item ${inventoryItem.id} at location ${locationId}`)

        if (inventoryService.createInventoryLevel) {
          await inventoryService.createInventoryLevel({
            inventory_item_id: inventoryItem.id,
            location_id: locationId,
            stocked_quantity: operation.quantity,
            reserved_quantity: 0,
          })
          console.log(`Created new inventory level with quantity ${operation.quantity}`)
        } else if (inventoryService.createInventoryLevels) {
          await inventoryService.createInventoryLevels([
            {
              inventory_item_id: inventoryItem.id,
              location_id: locationId,
              stocked_quantity: operation.quantity,
              reserved_quantity: 0,
            },
          ])
          console.log(`Created new inventory level via batch create`)
        } else {
          throw new Error("No method available to create inventory levels")
        }
      }
    } catch (levelError) {
      console.error(`Error handling inventory level: ${levelError.message}`)
      throw new Error(`Failed to update inventory level: ${levelError.message}`)
    }
  } catch (error) {
    console.error(`Error updating inventory for variant ${operation.variant_id}:`, error)
    throw new Error(`Failed to update inventory: ${error.message}`)
  }
}

async function deleteInventoryForVariant(inventoryService: any, variantId: string) {
  console.log(`Deleting inventory for variant ${variantId}`)

  try {
    // Find inventory items to delete
    let inventoryItems: any[] = []

    if (inventoryService.listInventoryItems) {
      const result = await inventoryService.listInventoryItems({})
      const allItems = Array.isArray(result) ? result : result?.data || result?.inventory_items || []

      inventoryItems = allItems.filter(
        (item) => item.variant_id === variantId || (item.metadata && item.metadata.variant_id === variantId),
      )
    } else if (inventoryService.list) {
      const result = await inventoryService.list({})
      const allItems = Array.isArray(result) ? result : result?.data || []

      inventoryItems = allItems.filter(
        (item) => item.variant_id === variantId || (item.metadata && item.metadata.variant_id === variantId),
      )
    }

    if (inventoryItems.length === 0) {
      console.log(`No inventory found for variant ${variantId}`)
      return
    }

    // Delete each inventory item
    for (const item of inventoryItems) {
      if (inventoryService.deleteInventoryItems) {
        await inventoryService.deleteInventoryItems([item.id])
        console.log(`Deleted inventory item ${item.id}`)
      } else if (inventoryService.deleteInventoryItem) {
        await inventoryService.deleteInventoryItem(item.id)
        console.log(`Deleted inventory item ${item.id}`)
      } else if (inventoryService.delete) {
        await inventoryService.delete(item.id)
        console.log(`Deleted inventory item ${item.id} via legacy method`)
      }
    }
  } catch (error) {
    console.error(`Error deleting inventory for variant ${variantId}:`, error)
    throw new Error(`Failed to delete inventory: ${error.message}`)
  }
}
