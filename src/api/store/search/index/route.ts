// api/admin/search/index/route.ts
import { Request as MedusaRequest, Response as MedusaResponse } from "express"
import { AlgoliaService } from '../../../../services/algolia.service';

// Extend Express Request type to include 'scope'
declare module "express-serve-static-core" {
  interface Request {
    scope?: any;
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  console.log('🔍 POST /admin/search/index - Starting request');
  
  try {
    // Debug container and scope
    console.log('🔍 Request scope exists:', !!req.scope);
    console.log('🔍 Request scope type:', typeof req.scope);
    
    if (req.scope) {
      console.log('🔍 Available services in container:');
      try {
        // Try to get container registrations
        const container = (typeof (req.scope as any).cradle === "object" && (req.scope as any).cradle) || req.scope;
        console.log('🔍 Container keys:', Object.keys(container));
        
        // Check for variations of the service name
        const serviceVariations = [
          'algoliaService',
          'AlgoliaService', 
          'algolia',
          'Algolia',
          'algolia-service',
          'algoliaservice'
        ];
        
        serviceVariations.forEach(serviceName => {
          const exists = container[serviceName] !== undefined;
          console.log(`🔍 Service '${serviceName}' exists:`, exists);
          if (exists) {
            console.log(`🔍 Service '${serviceName}' type:`, typeof container[serviceName]);
          }
        });
        
      } catch (containerError) {
        console.error('🔍 Error inspecting container:', containerError);
      }
    }
    
    console.log('🔍 Attempting to resolve algoliaService...');
    
    let algoliaService;
    try {
      // First try to resolve from container
      algoliaService = req.scope.resolve("algoliaService");
      console.log('✅ AlgoliaService resolved from container successfully');
    } catch (resolveError) {
      console.error('❌ Failed to resolve from container:', resolveError.message);
      
      // Fallback: Try direct instantiation
      console.log('🔍 Attempting direct instantiation fallback...');
      try {
        const { AlgoliaService } = require('../../../../services/algolia.service');
        const appId = process.env.ALGOLIA_APP_ID;
        const apiKey = process.env.ALGOLIA_ADMIN_API_KEY;
        const indexName = process.env.ALGOLIA_INDEX_NAME || "products";
        
        if (!appId || !apiKey) {
          throw new Error('Missing Algolia environment variables');
        }
        
        algoliaService = new AlgoliaService(appId, apiKey, indexName);
        console.log('✅ AlgoliaService created via direct instantiation');
      } catch (directError) {
        console.error('❌ Direct instantiation also failed:', directError.message);
        throw new Error('AlgoliaService is not available');
      }
    }
    
    console.log('✅ AlgoliaService resolved successfully');
    console.log('🔍 AlgoliaService type:', typeof algoliaService);
    console.log('🔍 AlgoliaService methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(algoliaService)));
    
    const { action, products } = req.body;
    console.log('🔍 Request body action:', action);
    console.log('🔍 Request body products length:', products?.length);

    switch (action) {
      case 'reindex':
        console.log('🔍 Executing reindex action');
        if (products && Array.isArray(products)) {
          console.log('🔍 Calling indexProducts with', products.length, 'products');
          await algoliaService.indexProducts(products);
          console.log('✅ indexProducts completed');
        } else {
          console.log('⚠️ No valid products array provided for reindex');
        }
        break;
      
      case 'clear':
        console.log('🔍 Executing clear action');
        await algoliaService.clearIndex();
        console.log('✅ clearIndex completed');
        break;
      
      case 'initialize':
        console.log('🔍 Executing initialize action');
        await algoliaService.initializeIndex();
        console.log('✅ initializeIndex completed');
        break;
      
      default:
        console.log('❌ Invalid action provided:', action);
        return res.status(400).json({
          success: false, 
          error: 'Invalid action'
        });
    }

    console.log('✅ Action completed successfully');
    res.json({
      success: true,
      message: `Action '${action}' completed successfully`
    });
  } catch (error) {
    console.error('❌ Index management API error:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Additional debugging for resolution errors
    if (error.message?.includes('Could not resolve')) {
      console.error('🔍 Resolution error details:');
      console.error('🔍 Trying to resolve:', "algoliaService");
      console.error(
        '🔍 Available in scope:',
        req.scope
          ? Object.keys(
              // Check if cradle exists, otherwise use req.scope directly
              (typeof (req.scope as any).cradle === "object" && (req.scope as any).cradle) || req.scope
            )
          : 'No scope'
      );
    }
    
    res.status(500).json({
      success: false, 
      error: 'Internal server error',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  console.log('🔍 GET /admin/search/index - Starting request');
  
  try {
    // Debug container and scope
    console.log('🔍 Request scope exists:', !!req.scope);
    
    console.log('🔍 Attempting to resolve algoliaService for GET...');
    
    let algoliaService;
    try {
      // First try to resolve from container
      algoliaService = req.scope.resolve("algoliaService");
      console.log('✅ AlgoliaService resolved from container successfully for GET');
    } catch (resolveError) {
      console.error('❌ Failed to resolve from container for GET:', resolveError.message);
      
      // Fallback: Try direct instantiation
      console.log('🔍 Attempting direct instantiation fallback for GET...');
      try {
        const { AlgoliaService } = require('../../../../services/algolia.service');
        const appId = process.env.ALGOLIA_APP_ID;
        const apiKey = process.env.ALGOLIA_ADMIN_API_KEY;
        const indexName = process.env.ALGOLIA_INDEX_NAME || "products";
        
        if (!appId || !apiKey) {
          throw new Error('Missing Algolia environment variables for GET');
        }
        
        algoliaService = new AlgoliaService(appId, apiKey, indexName);
        console.log('✅ AlgoliaService created via direct instantiation for GET');
      } catch (directError) {
        console.error('❌ Direct instantiation also failed for GET:', directError.message);
        throw new Error('AlgoliaService is not available for GET');
      }
    }
    
    console.log('✅ AlgoliaService resolved successfully for GET');
    
    console.log('🔍 Calling getIndexStats...');
    const stats = await algoliaService.getIndexStats();
    console.log('✅ getIndexStats completed', stats);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Index stats API error:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Additional debugging for resolution errors
    if (error.message?.includes('Could not resolve')) {
      console.error('🔍 GET Resolution error details:');
      console.error('🔍 Trying to resolve:', "algoliaService");
      console.error(
        '🔍 Available in scope:',
        req.scope
          ? Object.keys(
              typeof (req.scope as any).cradle === "object" && (req.scope as any).cradle
                ? (req.scope as any).cradle
                : req.scope
            )
          : 'No scope'
      );
    }
    
    res.status(500).json({
      success: false, 
      error: 'Internal server error',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}