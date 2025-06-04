// src/api/admin/bulk-upload/route.ts

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
  createInventoryItemsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";
import multer from "multer";
import { parseCSVToProducts, validateCSVStructure } from "../../../utils/csv-parser";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Create upload middleware
const uploadMiddleware = upload.single('csv_file');

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    // Handle multipart form data
    await new Promise<void>((resolve, reject) => {
      uploadMiddleware(req as any, res as any, (err) => {
        if (err) {
          console.error('Upload error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await handleBulkUpload(req, res);
  } catch (error) {
    console.error('POST error:', error);
    res.status(400).json({ 
      error: error.message || 'File upload failed',
      details: error.toString()
    });
  }
}

async function handleBulkUpload(req: MedusaRequest, res: MedusaResponse) {
  const container = req.scope;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ 
      error: 'No CSV file provided. Please upload a CSV file.' 
    });
  }

  try {
    // Parse CSV file
    const products = await parseCSVToProducts(file.buffer);
    
    if (products.length === 0) {
      return res.status(400).json({ 
        error: 'No valid products found in CSV file' 
      });
    }

    console.log(`Parsed ${products.length} products from CSV`);

    // 1. Fetch the stock location named "Vellore"
    const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION);
    const [stockLocation] = await stockLocationModuleService.listStockLocations({
      id: ["sloc_01JRVQC6W9MDC34VYY657S3ZDS"],
    });
    
    if (!stockLocation) {
      return res.status(404).json({ 
        message: "Stock location 'Vellore' not found" 
      });
    }

    // 2. Fetch the shipping profile named "Vellore"
    const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
    const [shippingProfile] = await fulfillmentModuleService.listShippingProfiles(
      { id: ["sp_01JWRTQ2VF9XGRT9655FJDJJZJ"] }
    );
    
    if (!shippingProfile) {
      return res.status(404).json({ 
        message: "Shipping profile 'Vellore' not found" 
      });
    }

    // 3. Check for existing inventory items and filter out duplicates
    const inventoryModuleService = container.resolve(Modules.INVENTORY);
    const allSkus = products.flatMap(product => product.variants.map(variant => variant.sku));
    
    // Check which SKUs already exist
    const existingInventoryItems = await inventoryModuleService.listInventoryItems({
      sku: allSkus,
    });
    
    const existingSkus = new Set(existingInventoryItems.map(item => item.sku));
    console.log('Existing SKUs found:', Array.from(existingSkus));
    
    // Filter out products with existing SKUs
    const newProducts = products.map(product => ({
      ...product,
      variants: product.variants.filter(variant => !existingSkus.has(variant.sku))
    })).filter(product => product.variants.length > 0);
    
    const skippedProducts = products.filter(product => 
      product.variants.every(variant => existingSkus.has(variant.sku))
    );
    
    console.log(`New products to create: ${newProducts.length}`);
    console.log(`Skipped products (already exist): ${skippedProducts.length}`);
    
    if (newProducts.length === 0) {
      return res.status(200).json({
        message: "All products already exist in the system",
        skipped_products: skippedProducts.length,
        existing_skus: Array.from(existingSkus)
      });
    }
    
    // 4. Create inventory items for new variants only
    const { result: inventoryResult } = await createInventoryItemsWorkflow(
      container
    ).run({
      input: {
        items: newProducts.flatMap((product) =>
          product.variants.map((variant) => ({
            sku: variant.sku,
            title: variant.title,
            location_levels: [
              {
                stocked_quantity: variant.stocked_quantity,
                location_id: stockLocation.id,
              },
            ],
          }))
        ),
      },
    });

    // 5. Link inventory items to variants
    let idx = 0;
    const productsWithInventory = newProducts.map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        inventory_items: [
          {
            inventory_item_id: inventoryResult[idx++].id,
          },
        ],
      })),
    }));

    // 6. Create products with linked inventory items and Vellore shipping profile
    const { result: productsResult } = await createProductsWorkflow(container).run({
      input: {
        products: productsWithInventory.map((product) => ({
          title: product.title,
          options: product.options,
          variants: product.variants.map((variant) => ({
            title: variant.title,
            sku: variant.sku,
            prices: variant.prices,
            options: variant.options,
            inventory_items: variant.inventory_items,
          })),
          shipping_profile_id: shippingProfile.id,
          sales_channels: [
            { id: "sc_01JRRBTKHJ966F0TJ71F2GJR6P" }, 
            { id: "sc_01JT2Q2X5WWCARJZTSPZMV4Z93" },
          ],
        })),
      },
    });

    res.status(200).json({
      message: `Successfully processed CSV upload`,
      products_created: productsResult.length,
      inventory_items_created: inventoryResult.length,
      skipped_products: skippedProducts.length,
      existing_skus: Array.from(existingSkus),
      stockLocation: stockLocation.name,
      shippingProfile: shippingProfile.name,
      summary: {
        total_products_in_csv: products.length,
        new_products_created: newProducts.length,
        duplicate_products_skipped: skippedProducts.length
      }
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process CSV file',
      details: error.message 
    });
  }
}