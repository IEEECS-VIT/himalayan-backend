// Updated search route with better debugging for product_id and handle
// api/admin/search/route.ts
import type { Request, Response } from "express"
import { AlgoliaService } from '../../../services/algolia.service'

type SearchFilters = {
  category?: string
  price_min?: number
  price_max?: number
  currency_code?: string
  in_stock?: boolean
  tags?: string[]
}

const algoliaService = new AlgoliaService(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_API_KEY!,
  process.env.ALGOLIA_INDEX_NAME || "products"
)

export async function GET(req: Request, res: Response) {
  try {
    console.log('=== SEARCH REQUEST START ===')
    console.log('Query params:', req.query)
    
    const { 
      query = '', 
      page = '0', 
      limit = '20', 
      category, 
      price_min, 
      price_max, 
      currency_code, 
      in_stock, 
      tags 
    } = req.query

    const pageNum = parseInt(page as string)
    const hitsPerPage = parseInt(limit as string)

    const filters: SearchFilters = {}
    
    if (category) filters.category = category as string
    if (price_min) filters.price_min = parseFloat(price_min as string)
    if (price_max) filters.price_max = parseFloat(price_max as string)
    if (currency_code) filters.currency_code = currency_code as string
    if (in_stock === 'true') filters.in_stock = true
    if (tags) filters.tags = (tags as string).split(',')

    console.log('=== SEARCH PARAMETERS ===')
    console.log('Query:', `"${query}"`)
    console.log('Filters:', JSON.stringify(filters, null, 2))

    const results = await algoliaService.search(query as string, filters, pageNum, hitsPerPage)

    console.log('=== SEARCH RESULTS ===')
    console.log('Total hits:', results.nbHits)
    console.log('Returned results:', results.hits.length)
    
    if (results.hits.length > 0) {
      console.log('Sample results with product_id and handle:')
      results.hits.slice(0, 3).forEach((hit, index) => {
        console.log(`  ${index + 1}. Product: ${hit.product_title}`)
        console.log(`     - Product ID: ${hit.product_id}`)
        console.log(`     - Handle: ${hit.handle}`)
        console.log(`     - Price: ${hit.price} ${hit.currency_code}`)
        console.log(`     - Object ID: ${hit.objectID}`)
        console.log('     ---')
      })
    } else {
      console.log('No results found!')
    }

    // Ensure all results have product_id and handle
    const enhancedResults = {
      ...results,
      hits: results.hits.map(hit => ({
        ...hit,
        product_id: hit.product_id, // This should already be set from the service
        handle: hit.handle, // This should already be set from the service
      }))
    }

    res.json({
      success: true,
      data: enhancedResults,
      debug: {
        query: query,
        filters: filters,
        totalHits: results.nbHits,
        resultCount: results.hits.length,
        sampleProductIds: results.hits.slice(0, 3).map(hit => hit.product_id),
        sampleHandles: results.hits.slice(0, 3).map(hit => hit.handle)
      }
    })
  } catch (error) {
    console.error('=== SEARCH API ERROR ===')
    console.error('Error:', error instanceof Error ? error.message : String(error))
    
    res.status(500).json({
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    })
  }
}

// Enhanced debug endpoint
export async function POST(req: Request, res: Response) {
  try {
    console.log('=== INDEX DEBUG REQUEST ===')
    
    const stats = await algoliaService.getIndexStats()
    const emptySearch = await algoliaService.search("", {}, 0, 10)
    
    res.json({
      success: true,
      debug: {
        indexStats: stats,
        totalRecords: emptySearch.nbHits,
        sampleRecords: emptySearch.hits.slice(0, 5).map(hit => ({
          objectID: hit.objectID,
          product_id: hit.product_id,
          product_title: hit.product_title,
          handle: hit.handle,
          variant_title: hit.variant_title,
          status: hit.status
        }))
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}