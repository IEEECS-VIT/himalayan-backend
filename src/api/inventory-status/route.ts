import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { variant_id, sku } = req.query

    const inventoryService = await getInventoryService(req.scope)
    const stockLocationService = await getStockLocationService(req.scope)
    const productService = await getProductService(req.scope)

    if (!inventoryService) {
      return res.status(500).json({
        type: "service_error",
        message: "Inventory service not available",
        debug: {
          available_services: await getAvailableServices(req.scope),
          scope_available: !!req.scope,
        },
      })
    }

    // If variant_id or sku is provided, get specific inventory
    if (variant_id || sku) {
      const inventory = await getInventoryForVariant(inventoryService, variant_id as string, sku as string)
      const inventoryLevels = await getInventoryLevels(inventoryService, inventory)

      return res.status(200).json({
        variant_id: variant_id || "N/A",
        sku: sku || "N/A",
        inventory_items: inventory,
        inventory_levels: inventoryLevels,
        summary: {
          total_items: inventory.length,
          total_levels: inventoryLevels.length,
          total_stocked_quantity: inventoryLevels.reduce((sum, level) => sum + (level.stocked_quantity || 0), 0),
          total_reserved_quantity: inventoryLevels.reduce((sum, level) => sum + (level.reserved_quantity || 0), 0),
        },
      })
    }

    // Otherwise, get general inventory status
    const locations = await getStockLocations(stockLocationService)
    const allInventoryItems = await getAllInventoryItems(inventoryService)
    const serviceInfo = await getServiceInfo(req.scope)

    return res.status(200).json({
      message: "Inventory Status API",
      service_info: serviceInfo,
      available_locations: locations,
      inventory_summary: {
        total_inventory_items: allInventoryItems.length,
        sample_items: allInventoryItems.slice(0, 5).map((item) => ({
          id: item.id,
          sku: item.sku,
          variant_id: item.variant_id || item.metadata?.variant_id,
          manage_inventory: item.manage_inventory,
        })),
      },
      usage: {
        "GET /api/inventory-status?variant_id=variant_123": "Get inventory for specific variant",
        "GET /api/inventory-status?sku=TEST-B-S": "Get inventory for specific SKU",
        "GET /api/inventory-status": "Get general inventory status",
      },
    })
  } catch (error) {
    console.error("Inventory status error:", error)
    return res.status(500).json({
      type: "inventory_status_error",
      message: error?.message || "Failed to get inventory status",
      error_details:
        process.env.NODE_ENV === "development"
          ? {
              stack: error?.stack,
              name: error?.name,
            }
          : undefined,
    })
  }
}

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

async function getProductService(scope: any) {
  const serviceNames = ["productModuleService", "product", "@medusajs/product", "productService"]

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

async function getAvailableServices(scope: any) {
  const serviceNames = [
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
    "query",
    "manager",
  ]

  const available: string[] = []

  for (const serviceName of serviceNames) {
    try {
      const service = scope.resolve(serviceName)
      if (service) {
        available.push(serviceName)
      }
    } catch (error) {
      // Service not available
    }
  }

  return available
}

async function getServiceInfo(scope: any) {
  const inventoryService = await getInventoryService(scope)
  const stockLocationService = await getStockLocationService(scope)
  const productService = await getProductService(scope)

  return {
    inventory_service_available: !!inventoryService,
    inventory_service_methods: inventoryService
      ? Object.getOwnPropertyNames(Object.getPrototypeOf(inventoryService)).filter(
          (name) => typeof inventoryService[name] === "function",
        )
      : [],
    stock_location_service_available: !!stockLocationService,
    stock_location_service_methods: stockLocationService
      ? Object.getOwnPropertyNames(Object.getPrototypeOf(stockLocationService)).filter(
          (name) => typeof stockLocationService[name] === "function",
        )
      : [],
    product_service_available: !!productService,
    product_service_methods: productService
      ? Object.getOwnPropertyNames(Object.getPrototypeOf(productService)).filter(
          (name) => typeof productService[name] === "function",
        )
      : [],
  }
}

async function getInventoryForVariant(inventoryService: any, variantId?: string, sku?: string) {
  try {
    let result

    if (sku) {
      console.log(`Searching for inventory by SKU: ${sku}`)
      if (inventoryService.listInventoryItems) {
        result = await inventoryService.listInventoryItems({ sku })
      } else if (inventoryService.list) {
        result = await inventoryService.list({ sku })
      }
    } else if (variantId) {
      console.log(`Searching for inventory by variant_id: ${variantId}`)
      if (inventoryService.listInventoryItems) {
        // First try direct search
        try {
          result = await inventoryService.listInventoryItems({ variant_id: variantId })
        } catch (error) {
          // If direct search fails, get all and filter
          console.log("Direct variant_id search failed, trying manual filter")
          const allResult = await inventoryService.listInventoryItems({})
          const allItems = Array.isArray(allResult) ? allResult : allResult?.data || allResult?.inventory_items || []

          const filteredItems = allItems.filter(
            (item) => item.variant_id === variantId || (item.metadata && item.metadata.variant_id === variantId),
          )

          result = filteredItems
        }
      } else if (inventoryService.list) {
        try {
          result = await inventoryService.list({ variant_id: variantId })
        } catch (error) {
          const allResult = await inventoryService.list({})
          const allItems = Array.isArray(allResult) ? allResult : allResult?.data || []

          const filteredItems = allItems.filter(
            (item) => item.variant_id === variantId || (item.metadata && item.metadata.variant_id === variantId),
          )

          result = filteredItems
        }
      }
    }

    const items = Array.isArray(result) ? result : result?.data || result?.inventory_items || []
    console.log(`Found ${items.length} inventory items`)

    return items
  } catch (error) {
    console.error(`Error getting inventory:`, error)
    return []
  }
}

async function getInventoryLevels(inventoryService: any, inventoryItems: any[]) {
  const allLevels: any[] = []

  for (const item of inventoryItems) {
    try {
      let levels: any[] = []

      if (inventoryService.listInventoryLevels) {
        const result = await inventoryService.listInventoryLevels({
          inventory_item_id: item.id,
        })
        levels = Array.isArray(result) ? result : result?.data || []
      }

      allLevels.push(
        ...levels.map((level) => ({
          ...level,
          inventory_item_id: item.id,
          inventory_item_sku: item.sku,
        })),
      )
    } catch (error) {
      console.error(`Error getting levels for item ${item.id}:`, error)
    }
  }

  return allLevels
}

async function getAllInventoryItems(inventoryService: any) {
  try {
    let result
    if (inventoryService.listInventoryItems) {
      result = await inventoryService.listInventoryItems({})
    } else if (inventoryService.list) {
      result = await inventoryService.list({})
    } else {
      return []
    }

    const items = Array.isArray(result) ? result : result?.data || result?.inventory_items || []
    return items
  } catch (error) {
    console.error("Error getting all inventory items:", error)
    return []
  }
}

async function getStockLocations(stockLocationService: any) {
  if (!stockLocationService) return []

  try {
    const result = await stockLocationService.list({})
    const locations = Array.isArray(result) ? result : result?.data || []
    return locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      metadata: loc.metadata,
    }))
  } catch (error) {
    console.error("Error getting stock locations:", error)
    return []
  }
}
