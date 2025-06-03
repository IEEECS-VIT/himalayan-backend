// src/api/admin/bulk-upload/route.ts

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
  createInventoryItemsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";


// Future updates : mention collection and category like Vegeatbles and Fruits 

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const container = req.scope;

  // 1. Fetch the stock location named "Vellore"
  // TODO : list all stock locations and find the one with name "Vellore" (Input)

  const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION);
  const [stockLocation] = await stockLocationModuleService.listStockLocations({
    id: ["sloc_01JRVQC6W9MDC34VYY657S3ZDS"],
  });
  if (!stockLocation) {
    return res
      .status(404)
      .json({ message: "Stock location 'Vellore' not found" });
  }
  console.log(stockLocation);

  // 2. Fetch the shipping profile named "Vellore"
  // TODO : No Changes
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const [shippingProfile] = await fulfillmentModuleService.listShippingProfiles(
    { id: ["sp_01JWRTQ2VF9XGRT9655FJDJJZJ"] }
  );
  if (!shippingProfile) {
    return res
      .status(404)
      .json({ message: "Shipping profile 'Vellore' not found" });
  }
  console.log(shippingProfile);

  // TODO: Fetch as input from csv file 
  const dummyProducts = [
    {
      title: "Bicycle",
      options: [{ title: "Size", values: ["Small", "Large"] }],
      variants: [
        {
          title: "Bicycle - Small",
          sku: "BIKE-S",
          prices: [{ amount: 10000, currency_code: "inr" }],
          options: { Size: "Small" },
          stocked_quantity: 10,
        },
        {
          title: "Bicycle - Large",
          sku: "BIKE-L",
          prices: [{ amount: 12000, currency_code: "inr" }],
          options: { Size: "Large" },
          stocked_quantity: 5,
        },
      ],
    },
    {
      title: "Helmet",
      options: [{ title: "Color", values: ["Red", "Blue"] }],
      variants: [
        {
          title: "Helmet - Red",
          sku: "HELMET-R",
          prices: [{ amount: 2000, currency_code: "inr" }],
          options: { Color: "Red" },
          stocked_quantity: 20,
        },
        {
          title: "Helmet - Blue",
          sku: "HELMET-B",
          prices: [{ amount: 2000, currency_code: "inr" }],
          options: { Color: "Blue" },
          stocked_quantity: 15,
        },
      ],
    },
  ];

  // 5. Create inventory items for each variant at the Vellore location
  const { result: inventoryResult } = await createInventoryItemsWorkflow(
    container
  ).run({
    input: {
      items: dummyProducts.flatMap((product) =>
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

  // 6. Link inventory items to variants
  let idx = 0;
  const productsWithInventory = dummyProducts.map((product) => ({
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


  // TODO : Fetch Sales channel by name and link inventoey items to stock location
  // 7. Create products with linked inventory items and Vellore shipping profile
  await createProductsWorkflow(container).run({
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
    message: "Dummy products uploaded and linked to stock location",
    stockLocation,
    shippingProfile,
  });
}
