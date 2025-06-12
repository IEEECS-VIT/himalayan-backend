// src/loaders/algolia.ts - Custom loader with better error handling
import type { MedusaContainer } from "@medusajs/framework/types"
import { AlgoliaService } from "../services/algolia.service"
import { asValue } from "awilix"

export default async function algoliaLoader(container: MedusaContainer) {
  console.log("🚀 ========================================")
  console.log("🚀 ALGOLIA LOADER STARTED")
  console.log("🚀 ========================================")
  console.log("🔍 Starting Algolia loader...")
  console.log("🔍 Loader function called at:", new Date().toISOString())
  console.log("🔍 Container type:", typeof container)
  console.log("🔍 Container keys:", Object.keys(container).slice(0, 5), "... (showing first 5)")
  
  try {
    // Check if required environment variables are present
    const appId = process.env.ALGOLIA_APP_ID
    const apiKey = process.env.ALGOLIA_ADMIN_API_KEY
    const indexName = process.env.ALGOLIA_INDEX_NAME || "products"

    console.log("🔍 Environment variables check:")
    console.log("  - ALGOLIA_APP_ID:", appId ? "✅ Set" : "❌ Missing")
    console.log("  - ALGOLIA_ADMIN_API_KEY:", apiKey ? "✅ Set" : "❌ Missing")
    console.log("  - ALGOLIA_INDEX_NAME:", indexName)

    if (!appId) {
      console.warn("❌ ALGOLIA_APP_ID is not set. Skipping Algolia service registration.")
      return
    }

    if (!apiKey) {
      console.warn("❌ ALGOLIA_ADMIN_API_KEY is not set. Skipping Algolia service registration.")
      return
    }

    console.log("🔍 Creating AlgoliaService instance...")
    const algoliaService = new AlgoliaService(appId, apiKey, indexName)
    console.log("✅ AlgoliaService instance created")
    console.log("🔍 Service methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(algoliaService)))
    
    // Test a method to ensure the service is working
    console.log("🔍 Testing service method availability...")
    console.log("  - indexProducts method exists:", typeof algoliaService.indexProducts === 'function')
    console.log("  - clearIndex method exists:", typeof algoliaService.clearIndex === 'function')
    console.log("  - initializeIndex method exists:", typeof algoliaService.initializeIndex === 'function')
    console.log("  - getIndexStats method exists:", typeof algoliaService.getIndexStats === 'function')

    console.log("🔍 Registering service in container...")
    container.register({
      algoliaService: asValue(algoliaService)
    })
    console.log("✅ Service registered in container")

    // Verify registration immediately
    try {
      const resolvedService = container.resolve("algoliaService")
      console.log("✅ Service verification successful:", typeof resolvedService)
      console.log("🔍 Resolved service methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(resolvedService)))
    } catch (verifyError) {
      console.error("❌ Service verification failed:", verifyError)
    }

    // Initialize the index
    console.log("🔍 Initializing Algolia index...")
    await algoliaService.initializeIndex()
    console.log("✅ Algolia index initialized")

    console.log("✅ Algolia service registered successfully")
  } catch (error) {
    console.error("❌ Failed to register Algolia service:", error)
    console.error("❌ Error details:")
    console.error("  - Name:", error.name)
    console.error("  - Message:", error.message)
    console.error("  - Stack:", error.stack)
    
    // Don't throw the error to prevent server startup failure
    // But make it very obvious something went wrong
    console.error("⚠️  ALGOLIA SERVICE REGISTRATION FAILED - Service will not be available!")
  }
}