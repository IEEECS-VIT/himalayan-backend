import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { batchProductsWorkflow } from "@medusajs/medusa/core-flows"


type BatchProductWorkflowInput = {
  create?: Array<{
    title: string
    handle: string
    options?: Array<{
      title: string
      values: string[]
    }>
    variants?: Array<{
      title: string
      options: Record<string, string>
      prices: Array<{
        amount: number
        currency_code: string
      }>
    }>
  }>
  update?: Array<{
    id: string
    title?: string
    [key: string]: any
  }>
  delete?: string[]
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    // Basic validation to ensure required structure exists
    const input = req.body as BatchProductWorkflowInput
    
    if (!input || (typeof input !== 'object')) {
      return res.status(400).send({
        type: "invalid_data",
        message: "Request body must be a valid object"
      })
    }

    const { result } = await batchProductsWorkflow(req.scope).run({
      input
    })
    
    res.send(result)
  } catch (error) {
    console.error('Batch products error:', error)
    res.status(400).send({ 
      type: "batch_error", 
      message: error.message || "Failed to process batch operation" 
    })
  }
}