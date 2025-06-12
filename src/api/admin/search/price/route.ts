// api/admin/search/price/route.ts - Filter products by price range
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
    const min = searchParams.get("min") || "0"
    const max = searchParams.get("max") || "10000"
    const limit = searchParams.get("limit") || "20"

    console.log(`=== PRICE FILTER: ₹${min} - ₹${max} ===`)

    const results = await algoliaService.search(
      "", // Empty query to get all products
      {
        price_min: Number.parseFloat(min),
        price_max: Number.parseFloat(max),
      },
      0,
      Number.parseInt(limit),
    )

    return NextResponse.json({
      success: true,
      priceRange: { min: Number.parseFloat(min), max: Number.parseFloat(max) },
      totalProducts: results.nbHits,
      products: results.hits.map((hit) => ({
        id: hit.objectID,
        title: hit.product_title,
        variant: hit.variant_title,
        price: hit.price,
        currency: hit.currency_code,
        inStock: hit.stocked_quantity > 0,
        sku: hit.sku,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Price filter failed",
      },
      { status: 500 },
    )
  }
}
