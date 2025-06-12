// Updated search route with better debugging
// api/admin/search/route.ts
import type { Request, Response } from "express"
import { AlgoliaService } from '../../../services/algolia.service'
// Define SearchFilters type inline if not exported from algolia types
type SearchFilters = {
  category?: string
  price_min?: number
  price_max?: number
  currency_code?: string
  in_stock?: boolean
  tags?: string[]
}

// Make sure to use the same API key as in sync
const algoliaService = new AlgoliaService(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_API_KEY!, // Use same key as sync script
  process.env.ALGOLIA_INDEX_NAME || "products"
)

export async function GET(req: Request, res: Response) {
  try {
    console.log('=== SEARCH REQUEST START ===')
    console.log('Query params:', req.query)
    console.log('Environment check:')
    console.log('- App ID:', process.env.ALGOLIA_APP_ID ? 'SET' : 'NOT SET')
    console.log('- API Key:', process.env.ALGOLIA_ADMIN_API_KEY ? 'SET' : 'NOT SET')
    console.log('- Index Name:', process.env.ALGOLIA_INDEX_NAME || 'products (default)')
    
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
    
    if (category) {
      filters.category = category as string
    }
    
    if (price_min) {
      filters.price_min = parseFloat(price_min as string)
    }
    
    if (price_max) {
      filters.price_max = parseFloat(price_max as string)
    }
    
    if (currency_code) {
      filters.currency_code = currency_code as string
    }
    
    if (in_stock === 'true') {
      filters.in_stock = true
    }
    
    if (tags) {
      filters.tags = (tags as string).split(',')
    }

    console.log('=== SEARCH PARAMETERS ===')
    console.log('Query:', `"${query}"`)
    console.log('Filters:', JSON.stringify(filters, null, 2))
    console.log('Page:', pageNum, 'Hits per page:', hitsPerPage)

    const results = await algoliaService.search(query as string, filters, pageNum, hitsPerPage)

    console.log('=== SEARCH RESULTS ===')
    console.log('Total hits:', results.nbHits)
    console.log('Returned results:', results.hits.length)
    console.log('Processing time:', results.processingTimeMS, 'ms')
    
    if (results.hits.length > 0) {
      console.log('Sample results:')
      results.hits.slice(0, 3).forEach((hit, index) => {
        console.log(`  ${index + 1}. ${hit.product_title} (${hit.variant_title}) - ${hit.price} ${hit.currency_code}`)
      })
    } else {
      console.log('No results found!')
      
      // Additional debugging for empty results
      console.log('=== DEBUGGING EMPTY RESULTS ===')
      try {
        const emptySearch = await algoliaService.search("", {}, 0, 5)
        console.log('Empty query results:', emptySearch.nbHits, 'total hits')
        if (emptySearch.hits.length > 0) {
          console.log('Available products:', emptySearch.hits.map(h => h.product_title))
        }
      } catch (debugError) {
        console.log('Debug search failed:', debugError)
      }
    }

    res.json({
      success: true,
      data: results,
      debug: {
        query: query,
        filters: filters,
        totalHits: results.nbHits,
        resultCount: results.hits.length
      }
    })
  } catch (error) {
    console.error('=== SEARCH API ERROR ===')
    console.error('Error type:', error?.constructor?.name)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    
    res.status(500).json({
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    })
  }
}

// Debug endpoint to check index status
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
          product_title: hit.product_title,
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