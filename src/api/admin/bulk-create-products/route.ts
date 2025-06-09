// src/api/admin/bulk-upload/route.ts

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
  createInventoryItemsWorkflow,
  // updateInventoryLevelsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows";
import multer from "multer";
import {
  parseCSVToProducts,
  // validateCSVStructure,
} from "../../../utils/csv-parser";

type InputType = {
  stock_loc_name: string;
};
// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

const uploadMiddleware = upload.single("csv_file");

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    await new Promise<void>((resolve, reject) => {
      uploadMiddleware(req as any, res as any, (err) => {
        if (err) {
          console.error("Upload error:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await handleBulkUpload(req, res);
  } catch (error) {
    console.error("POST error:", error);
    res.status(400).json({
      error: error.message || "File upload failed",
      details: error.toString(),
    });
  }
}

async function handleBulkUpload(req: MedusaRequest, res: MedusaResponse) {
  const container = req.scope;
  const file = req.file;
  const input: InputType = req.body as InputType;
  console.log("Received input:", input);

  const stock_loc_name = input.stock_loc_name;

  if (!file) {
    return res.status(400).json({
      error: "No CSV file provided. Please upload a CSV file.",
    });
  }

  try {
    // Parse CSV file
    const products = await parseCSVToProducts(file.buffer);

    if (products.length === 0) {
      return res.status(400).json({
        error: "No valid products found in CSV file",
      });
    }

    console.log(`Parsed ${products.length} products from CSV`);

    // 1. Fetch the stock location named "Vellore"
    const stockLocationModuleService = container.resolve(
      Modules.STOCK_LOCATION
    );
    const [stockLocation] = await stockLocationModuleService.listStockLocations(
      {
        id: ["sloc_01JRVQC6W9MDC34VYY657S3ZDS"],
      }
    );

    if (!stockLocation) {
      return res.status(404).json({
        message: "Stock location 'Vellore' not found",
      });
    }

    // 2. Fetch the shipping profile named "Vellore" ```Will be HARDCODED```
    const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
    const [shippingProfile] =
      await fulfillmentModuleService.listShippingProfiles({
        id: ["sp_01JWRTQ2VF9XGRT9655FJDJJZJ"],
      });

    if (!shippingProfile) {
      return res.status(404).json({
        message: "Shipping profile 'Vellore' not found",
      });
    }

    // 3. Check for existing inventory items and separate new vs existing
    const inventoryModuleService = container.resolve(Modules.INVENTORY);
    const productModuleService = container.resolve(Modules.PRODUCT);
    const allSkus = products.flatMap((product) =>
      product.variants.map((variant) => variant.sku)
    );

    // Get existing inventory items
    const existingInventoryItems =
      await inventoryModuleService.listInventoryItems({
        sku: allSkus,
      });

    const existingSkusMap = new Map(
      existingInventoryItems.map((item) => [item.sku, item])
    );

    console.log("Existing SKUs found:", Array.from(existingSkusMap.keys()));

    // Separate new and existing products
    type ProductVariant = {
      title: string;
      sku: string;
      prices: { amount: number; currency_code: string }[];
      options: Record<string, string>;
      stocked_quantity: number;
      inventory_item?: any;
    };

    type ProductWithVariants = {
      title: string;
      options: { title: string; values: string[] }[];
      variants: ProductVariant[];
    };

    const newProducts: ProductWithVariants[] = [];
    const existingProducts: ProductWithVariants[] = [];

    for (const product of products) {
      const newVariants: ProductVariant[] = [];
      const existingVariants: ProductVariant[] = [];

      for (const variant of product.variants) {
        if (existingSkusMap.has(variant.sku)) {
          existingVariants.push({
            ...variant,
            inventory_item: existingSkusMap.get(variant.sku),
          });
        } else {
          newVariants.push(variant);
        }
      }

      if (newVariants.length > 0) {
        newProducts.push({
          ...product,
          variants: newVariants,
        });
      }

      if (existingVariants.length > 0) {
        existingProducts.push({
          ...product,
          variants: existingVariants,
        });
      }
    }

    console.log(`New products to create: ${newProducts.length}`);
    console.log(`Existing products to update: ${existingProducts.length}`);

    let createdProductsCount = 0;
    let createdInventoryCount = 0;
    let updatedInventoryCount = 0;
    let updatedProductsCount = 0;

    // 4. Create new products and inventory items
    if (newProducts.length > 0) {
      // Create inventory items for new variants
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

      // Link inventory items to variants
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

      // Create products with linked inventory items
      const { result: productsResult } = await createProductsWorkflow(
        container
      ).run({
        input: {
          products: productsWithInventory.map((product) => ({
            title: product.title,
            options: product.options,
            status: "published",
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

      createdProductsCount = productsResult.length;
      createdInventoryCount = inventoryResult.length;
    }

    // 5. Update existing inventory levels and product variants
    if (existingProducts.length > 0) {
      console.log("Updating existing products...");

      for (const product of existingProducts) {
        console.log(`Updating product: ${product.title}`);

        for (const variant of product.variants) {
          const inventoryItem = variant.inventory_item;
          console.log(`Updating variant: ${variant.sku}`);

          try {
            // 1. Update inventory levels (stock quantity)
            const inventoryLevels =
              await inventoryModuleService.listInventoryLevels({
                inventory_item_id: [inventoryItem.id],
                location_id: [stockLocation.id],
              });

            if (inventoryLevels.length > 0) {
              await inventoryModuleService.updateInventoryLevels([
                {
                  inventory_item_id: inventoryItem.id,
                  location_id: stockLocation.id,
                  stocked_quantity: variant.stocked_quantity,
                },
              ]);
              console.log(
                `✅ Updated inventory for ${variant.sku}: ${variant.stocked_quantity}`
              );
              updatedInventoryCount++;
            } else {
              await inventoryModuleService.createInventoryLevels([
                {
                  inventory_item_id: inventoryItem.id,
                  location_id: stockLocation.id,
                  stocked_quantity: variant.stocked_quantity,
                },
              ]);
              console.log(
                `✅ Created inventory level for ${variant.sku}: ${variant.stocked_quantity}`
              );
              updatedInventoryCount++;
            }

            // 2. Update product variant (title, options, etc.)
            try {
              const existingProductVariants =
                await productModuleService.listProductVariants({
                  sku: [variant.sku],
                });

              if (existingProductVariants.length > 0) {
                const existingVariant = existingProductVariants[0];

                // Use the updateProductVariantsWorkflow instead of direct service call
                await updateProductVariantsWorkflow(container).run({
                  input: {
                    selector: { id: existingVariant.id },
                    update: {
                      title: variant.title,
                      options: variant.options,
                    },
                  },
                });

                console.log(`✅ Updated product variant ${variant.sku}`);
                updatedProductsCount++;

                // 3. Update prices separately using pricing module
                try {
                  const pricingModuleService = container.resolve(
                    Modules.PRICING
                  );

                  // Get existing price sets for this variant
                  const priceSets = await pricingModuleService.listPriceSets({
                    id: [existingVariant.id],
                  });

                  if (priceSets.length > 0 && variant.prices.length > 0) {
                    const priceSetId = priceSets[0].id;

                    // Update prices in the price set
                    await pricingModuleService.updatePriceSets(priceSetId, {
                      prices: variant.prices.map((price) => ({
                        amount: price.amount,
                        currency_code: price.currency_code,
                      })),
                    });

                    console.log(`✅ Updated prices for ${variant.sku}`);
                  } else {
                    // If no price set exists, create a new price set with prices
                    if (variant.prices.length > 0) {
                      await pricingModuleService.createPriceSets({
                        // variants: [existingVariant.id],
                        prices: variant.prices.map((price) => ({
                          amount: price.amount,
                          currency_code: price.currency_code,
                        })),
                      });
                      console.log(`✅ Created price set for ${variant.sku}`);
                    }
                  }
                } catch (priceError) {
                  console.log(
                    `⚠️ Price update failed for ${variant.sku}:`,
                    priceError.message
                  );
                  // Don't fail the whole process for price errors
                }
              } else {
                console.log(
                  `⚠️ Product variant not found for SKU: ${variant.sku}`
                );
              }
            } catch (variantError) {
              console.error(
                `❌ Failed to update product variant ${variant.sku}:`,
                variantError.message
              );
            }
          } catch (updateError) {
            console.error(
              `❌ Failed to update variant ${variant.sku}:`,
              updateError.message
            );
          }
        }
      }

      console.log(
        `Update summary: ${updatedProductsCount} products, ${updatedInventoryCount} inventory items`
      );
    }

    res.status(200).json({
      message: "Successfully processed CSV upload with updates",
      created: {
        products: createdProductsCount,
        inventory_items: createdInventoryCount,
      },
      updated: {
        products: updatedProductsCount,
        inventory_items: updatedInventoryCount,
      },
      stockLocation: stockLocation.name,
      shippingProfile: shippingProfile.name,
      summary: {
        total_products_in_csv: products.length,
        new_products_created: newProducts.length,
        existing_products_updated: existingProducts.length,
        total_operations: createdProductsCount + updatedProductsCount,
        inventory_updates: updatedInventoryCount,
        variant_updates: updatedProductsCount,
      },
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    res.status(500).json({
      error: "Failed to process CSV file",
      details: error.message,
    });
  }
}
