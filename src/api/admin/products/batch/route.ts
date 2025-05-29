import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { batchProductsWorkflow } from "@medusajs/medusa/core-flows"

type BatchProductWorkflowInput = {
  create?: Array<{
    title: string
    handle: string
    description?: string
    status?: "draft" | "proposed" | "published" | "rejected"
    thumbnail?: string
    // Physical dimensions
    length?: number
    height?: number
    width?: number
    weight?: number
    // Product images
    images?: Array<{
      url: string
      alt_text?: string
    }>
    // Product options (like size, color)
    options?: Array<{
      title: string
      values: string[]
    }>
    // Product variants
    variants?: Array<{
      title: string
      sku?: string
      barcode?: string
      // Variant dimensions
      length?: number
      height?: number
      width?: number
      weight?: number
      // Variant options (size: "Large", color: "Red")
      options: Record<string, string>
      // Pricing for this variant
      prices: Array<{
        amount: number
        currency_code: string
        region_id?: string
      }>
    }>
    // Custom metadata
    metadata?: Record<string, any>
  }>
  update?: Array<{
    id: string
    title?: string
    handle?: string
    description?: string
    status?: "draft" | "proposed" | "published" | "rejected"
    thumbnail?: string
    // Physical dimensions
    length?: number
    height?: number
    width?: number
    weight?: number
    // Product images
    images?: Array<{
      url: string
      alt_text?: string
    }>
    // Product options
    options?: Array<{
      title: string
      values: string[]
    }>
    // Product variants
    variants?: Array<{
      id?: string // Include ID for updating existing variants
      title: string
      sku?: string
      barcode?: string
      length?: number
      height?: number
      width?: number
      weight?: number
      options: Record<string, string>
      prices: Array<{
        amount: number
        currency_code: string
        region_id?: string
      }>
    }>
    metadata?: Record<string, any>
    [key: string]: any
  }>
  delete?: string[]
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    // Validate request body structure
    const input = req.body as BatchProductWorkflowInput
    
    if (!input || typeof input !== 'object') {
      return res.status(400).json({
        type: "invalid_data",
        message: "Request body must be a valid object"
      })
    }

    // Validate that at least one operation is provided
    if (!input.create && !input.update && !input.delete) {
      return res.status(400).json({
        type: "invalid_data",
        message: "At least one of 'create', 'update', or 'delete' must be provided"
      })
    }

    // Validate create array if provided
    if (input.create && Array.isArray(input.create)) {
      for (const product of input.create) {
        if (!product.title || !product.handle) {
          return res.status(400).json({
            type: "invalid_data",
            message: "Each product in 'create' array must have 'title' and 'handle'"
          })
        }
        
        // Validate variants if provided
        if (product.variants && Array.isArray(product.variants)) {
          for (const variant of product.variants) {
            if (!variant.title || !variant.options || !variant.prices) {
              return res.status(400).json({
                type: "invalid_data",
                message: "Each variant must have 'title', 'options', and 'prices'"
              })
            }
            
            // Validate prices array
            if (!Array.isArray(variant.prices) || variant.prices.length === 0) {
              return res.status(400).json({
                type: "invalid_data", 
                message: "Each variant must have at least one price"
              })
            }
          }
        }
      }
    }

    // Validate update array if provided
    if (input.update && Array.isArray(input.update)) {
      for (const product of input.update) {
        if (!product.id) {
          return res.status(400).json({
            type: "invalid_data",
            message: "Each product in 'update' array must have an 'id'"
          })
        }
      }
    }

    // Execute the batch products workflow
    const { result } = await batchProductsWorkflow(req.scope).run({
      input
    })
    
    return res.status(200).json({
      success: true,
      data: result
    })
    
  } catch (error) {
    console.error('Batch products workflow error:', error)
    
    // Handle specific Medusa errors
    if (error?.type === 'duplicate_error') {
      return res.status(409).json({
        type: "duplicate_error",
        message: error.message || "Duplicate product handle or SKU"
      })
    }
    
    if (error?.type === 'not_found') {
      return res.status(404).json({
        type: "not_found",
        message: error.message || "Product not found"
      })
    }
    
    // Generic error handling
    return res.status(400).json({
      type: "batch_error",
      message: error?.message || "Failed to process batch operation",
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    })
  }
}