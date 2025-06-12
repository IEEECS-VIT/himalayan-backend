// api/admin/search/simple-test/route.ts - Simplest possible test
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  console.log("🎯 SIMPLE TEST ENDPOINT HIT")

  try {
    // Just return environment info without calling Algolia
    return NextResponse.json({
      success: true,
      message: "Endpoint is working!",
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasAlgoliaAppId: !!process.env.ALGOLIA_APP_ID,
        hasAlgoliaApiKey: !!process.env.ALGOLIA_ADMIN_API_KEY,
        algoliaIndexName: process.env.ALGOLIA_INDEX_NAME || "products (default)",
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error(" Even simple test failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Simple test failed",
      },
      { status: 500 },
    )
  }
}
