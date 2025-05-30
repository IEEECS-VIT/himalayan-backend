import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { batchProductsWorkflow } from "@medusajs/medusa/core-flows"

type BatchProductWorkflowInput = {
  create?: Array<{
    title: string
    handle: string
    description?: string
    status?: "draft" | "proposed" | "published" | "rejected"
    thumbnail?: string
    length?: number
    height?: number
    width?: number
    weight?: number
    images?: Array<{
      url: string
      alt_text?: string
    }>
    options?: Array<{
      title: string
      values: string[]
    }>
    variants?: Array<{
      title: string
      sku?: string
      barcode?: string
      manage_inventory?: boolean
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
  }>
  update?: Array<{
    id: string
    title?: string
    handle?: string
    description?: string
    status?: "draft" | "proposed" | "published" | "rejected"
    thumbnail?: string
    length?: number
    height?: number
    width?: number
    weight?: number
    images?: Array<{
      url: string
      alt_text?: string
    }>
    options?: Array<{
      title: string
      values: string[]
    }>
    variants?: Array<{
      id?: string
      title: string
      sku?: string
      barcode?: string
      manage_inventory?: boolean
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
    console.log('=== BATCH PRODUCTS API DEBUG START ===')
    console.log('Request method:', req.method)
    console.log('Request headers:', JSON.stringify(req.headers, null, 2))
    console.log('Request body type:', typeof req.body)
    console.log('Request body:', JSON.stringify(req.body, null, 2))
    console.log('Request scope exists:', !!req.scope)
    
    const input = req.body as BatchProductWorkflowInput

    // Enhanced input validation
    if (!input || typeof input !== 'object') {
      console.log('❌ Invalid input: not an object')
      return res.status(400).json({
        type: "invalid_data",
        message: "Request body must be a valid object",
        received: typeof input
      })
    }

    if (!input.create && !input.update && !input.delete) {
      console.log('❌ Invalid input: no operations specified')
      return res.status(400).json({
        type: "invalid_data",
        message: "At least one of 'create', 'update', or 'delete' must be provided",
        received: Object.keys(input)
      })
    }

    console.log('✅ Input validation passed')

    // Validate required fields for create operations
    if (input.create) {
      console.log(`Validating ${input.create.length} products for creation...`)
      for (const [index, product] of input.create.entries()) {
        console.log(`Validating product ${index + 1}:`, JSON.stringify(product, null, 2))
        
        if (!product.title || !product.handle) {
          console.log(`❌ Product ${index + 1} missing required fields`)
          return res.status(400).json({
            type: "validation_error",
            message: `Product ${index + 1} must have both 'title' and 'handle' fields`,
            product_index: index,
            received: { title: product.title, handle: product.handle }
          })
        }

        // Validate variants if provided
        if (product.variants) {
          for (const [vIndex, variant] of product.variants.entries()) {
            console.log(`Validating variant ${vIndex + 1} for product ${index + 1}:`, JSON.stringify(variant, null, 2))
            
            if (!variant.title) {
              console.log(`❌ Variant ${vIndex + 1} missing title`)
              return res.status(400).json({
                type: "validation_error",
                message: `Variant ${vIndex + 1} in product ${index + 1} must have a title`,
                product_index: index,
                variant_index: vIndex
              })
            }

            if (!variant.prices || variant.prices.length === 0) {
              console.log(`❌ Variant ${vIndex + 1} missing prices`)
              return res.status(400).json({
                type: "validation_error",
                message: `Variant ${vIndex + 1} in product ${index + 1} must have at least one price`,
                product_index: index,
                variant_index: vIndex
              })
            }

            // Validate each price
            for (const [pIndex, price] of variant.prices.entries()) {
              if (!price.amount || !price.currency_code) {
                console.log(`❌ Price ${pIndex + 1} invalid`)
                return res.status(400).json({
                  type: "validation_error",
                  message: `Price ${pIndex + 1} in variant ${vIndex + 1} must have amount and currency_code`,
                  product_index: index,
                  variant_index: vIndex,
                  price_index: pIndex,
                  received: price
                })
              }
            }
          }
        }
      }
      console.log('✅ Create products validation passed')
    }

    // Validate required fields for update operations
    if (input.update) {
      console.log(`Validating ${input.update.length} products for update...`)
      for (const [index, product] of input.update.entries()) {
        console.log(`Validating update product ${index + 1}:`, JSON.stringify(product, null, 2))
        
        if (!product.id) {
          console.log(`❌ Update product ${index + 1} missing ID`)
          return res.status(400).json({
            type: "validation_error",
            message: `Update operation ${index + 1} must include product 'id'`,
            product_index: index,
            received: product
          })
        }
      }
      console.log('✅ Update products validation passed')
    }

    // Enhanced scope validation
    if (!req.scope) {
      console.error('❌ req.scope is undefined')
      console.error('Available req properties:', Object.keys(req))
      return res.status(500).json({
        type: "server_error",
        message: "Request scope not available - this might indicate a middleware issue",
        available_properties: Object.keys(req)
      })
    }

    console.log('✅ Request scope validated')
    console.log('Scope type:', typeof req.scope)
    console.log('Scope properties:', Object.keys(req.scope))

    // Check if batchProductsWorkflow is available
    if (typeof batchProductsWorkflow !== 'function') {
      console.error('❌ batchProductsWorkflow is not a function')
      return res.status(500).json({
        type: "server_error",
        message: "Batch products workflow is not available",
        workflow_type: typeof batchProductsWorkflow
      })
    }

    console.log('✅ Workflow function validated')
    console.log('About to execute batch workflow with input:', JSON.stringify(input, null, 2))

    // Execute batch products workflow with enhanced error catching
    let workflowResult
    try {
      const workflowInstance = batchProductsWorkflow(req.scope)
      console.log('Workflow instance created:', typeof workflowInstance)
      console.log('Workflow instance methods:', Object.keys(workflowInstance))
      
      workflowResult = await workflowInstance.run({
        input: input
      })
      
      console.log('✅ Workflow executed successfully')
    } catch (workflowError) {
      console.error('❌ Workflow execution error:')
      console.error('Workflow error message:', workflowError?.message)
      console.error('Workflow error type:', workflowError?.type)
      console.error('Workflow error code:', workflowError?.code)
      console.error('Workflow error name:', workflowError?.name)
      console.error('Workflow error stack:', workflowError?.stack)
      console.error('Full workflow error:', workflowError)
      
      // Re-throw to be caught by outer catch block
      throw workflowError
    }

    console.log('Raw workflow result type:', typeof workflowResult)
    console.log('Raw workflow result:', JSON.stringify(workflowResult, null, 2))

    const result = workflowResult?.result || workflowResult

    console.log('Processed result:', JSON.stringify(result, null, 2))
    console.log('✅ Batch workflow completed successfully')

    // Build response data
    const responseData: any = {
      success: true,
      data: result,
      message: "Products processed successfully. Use /api/inventory-management to handle inventory."
    }

    // Add helper data for inventory management
    if (result?.created && Array.isArray(result.created)) {
      console.log('Processing created products for inventory data...')
      responseData.variant_ids = result.created.flatMap(product => {
        console.log('Processing product:', JSON.stringify(product, null, 2))
        return product.variants?.map(variant => ({
          variant_id: variant.id,
          sku: variant.sku,
          product_title: product.title
        })) || []
      })
      console.log('Variant IDs for inventory:', responseData.variant_ids)
    }

    console.log('Final response data:', JSON.stringify(responseData, null, 2))
    console.log('=== BATCH PRODUCTS API DEBUG END ===')

    return res.status(200).json(responseData)

  } catch (error) {
    console.error('=== BATCH PRODUCTS ERROR DEBUG ===')
    console.error('Error occurred at:', new Date().toISOString())
    console.error('Error message:', error?.message)
    console.error('Error type:', error?.type)
    console.error('Error code:', error?.code)
    console.error('Error name:', error?.name)
    console.error('Error constructor:', error?.constructor?.name)
    console.error('Error stack:', error?.stack)
    console.error('Error cause:', error?.cause)
    console.error('Full error object:', error)
    console.error('Error properties:', Object.keys(error || {}))
    
    // Log additional error details
    if (error && typeof error === 'object') {
      for (const [key, value] of Object.entries(error)) {
        console.error(`Error.${key}:`, value)
      }
    }

    // Handle specific Medusa error types
    if (error?.type === 'duplicate_error' || error?.code === 'duplicate_error') {
      console.log('Handling duplicate error')
      return res.status(409).json({
        type: "duplicate_error",
        message: error.message || "Duplicate product handle or SKU detected",
        details: error
      })
    }

    if (error?.type === 'not_found' || error?.code === 'not_found') {
      console.log('Handling not found error')
      return res.status(404).json({
        type: "not_found",
        message: error.message || "Product not found",
        details: error
      })
    }

    if (error?.type === 'invalid_data' || error?.code === 'invalid_data') {
      console.log('Handling invalid data error')
      return res.status(400).json({
        type: "invalid_data",
        message: error.message || "Invalid data provided",
        details: error
      })
    }

    // Handle workflow execution errors
    if (error?.message?.includes('workflow') || error?.name === 'WorkflowError') {
      console.log('Handling workflow error')
      return res.status(400).json({
        type: "workflow_error",
        message: `Workflow execution failed: ${error.message}`,
        error_name: error?.name,
        error_type: error?.type,
        details: process.env.NODE_ENV === 'development' ? {
          stack: error?.stack,
          cause: error?.cause,
          full_error: error
        } : undefined
      })
    }

    // Enhanced generic error response
    console.log('Handling generic error')
    return res.status(500).json({
      type: "batch_error",
      message: error?.message || "Failed to process batch operation",
      error_name: error?.name || "UnknownError",
      error_type: error?.type || "unknown",
      error_code: error?.code || "unknown_error",
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? {
        stack: error?.stack,
        name: error?.name,
        cause: error?.cause,
        constructor: error?.constructor?.name,
        properties: Object.keys(error || {}),
        full_error: error
      } : {
        message: "Enable development mode for detailed error information"
      }
    })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return res.status(200).json({
    message: "Batch Products API",
    endpoints: {
      POST: "Create, update, or delete products in batch",
      note: "Use /api/inventory-management for inventory operations"
    },
    example_payload: {
      create: [
        {
          title: "Sample Product",
          handle: "sample-product",
          description: "A sample product",
          options: [
            {
              title: "Size",
              values: ["Small", "Medium", "Large"]
            },
            {
              title: "Color", 
              values: ["Red", "Blue", "Green"]
            }
          ],
          variants: [
            {
              title: "Small Red",
              sku: "SAMPLE-001-SM-RED",
              options: {
                "Size": "Small",
                "Color": "Red"
              },
              prices: [
                {
                  amount: 1000,
                  currency_code: "usd"
                }
              ]
            },
            {
              title: "Medium Blue",
              sku: "SAMPLE-002-MD-BLUE", 
              options: {
                "Size": "Medium",
                "Color": "Blue"
              },
              prices: [
                {
                  amount: 1200,
                  currency_code: "usd"
                }
              ]
            }
          ]
        }
      ]
    },
    simple_example: {
      create: [
        {
          title: "Simple Product",
          handle: "simple-product",
          description: "A simple product with default options",
          options: [
            {
              title: "Default Option",
              values: ["Default Value"]
            }
          ],
          variants: [
            {
              title: "Default Variant",
              sku: "SIMPLE-001",
              options: {
                "Default Option": "Default Value"
              },
              prices: [
                {
                  amount: 1000,
                  currency_code: "usd"
                }
              ]
            }
          ]
        }
      ]
    },
    debug_info: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    }
  })
}