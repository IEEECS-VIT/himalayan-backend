// api/admin/search/category/route.ts - Filter products by category
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
    const category = searchParams.get("name")
    const limit = searchParams.get("limit") || "20"

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: "Category name is required. Use ?name=category-name",
        },
        { status: 400 },
      )
    }

    console.log(`=== CATEGORY FILTER: ${category} ===`)

    const results = await algoliaService.search(
      "", // Empty query to get all products
      {
        category: category,
      },
      0,
      Number.parseInt(limit),
    )

    return NextResponse.json({
      success: true,
      category: category,
      totalProducts: results.nbHits,
      products: results.hits.map((hit) => ({
        id: hit.objectID,
        title: hit.product_title,
        variant: hit.variant_title,
        price: hit.price,
        currency: hit.currency_code,
        categories: hit.categories,
        inStock: hit.stocked_quantity > 0,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Category filter failed",
      },
      { status: 500 },
    )
  }
}
