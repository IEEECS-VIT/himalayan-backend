// api/admin/search/quick/route.ts - Quick product lookup by name
import { type NextRequest, NextResponse } from "next/server"
import { AlgoliaService } from "../../../../services/algolia.service"

const algoliaService = new AlgoliaService(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_API_KEY!,
  process.env.ALGOLIA_INDEX_NAME || "products",
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q") // Short for query
    const limit = searchParams.get("limit") || "5"

    if (!q || q.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "Query too short. Use ?q=search-term (minimum 2 characters)",
        },
        { status: 400 },
      )
    }

    console.log(`=== QUICK SEARCH: "${q}" ===`)

    const results = await algoliaService.search(q, {}, 0, Number.parseInt(limit))

    return NextResponse.json({
      success: true,
      query: q,
      found: results.nbHits,
      products: results.hits.map((hit) => ({
        id: hit.objectID,
        title: hit.product_title,
        variant: hit.variant_title,
        price: `₹${(hit.price / 100).toFixed(2)}`,
        inStock: hit.stocked_quantity > 0,
        sku: hit.sku,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Quick search failed",
      },
      { status: 500 },
    )
  }
}
