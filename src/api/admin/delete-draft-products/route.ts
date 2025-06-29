import { container } from "@medusajs/framework";
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Module, Modules } from "@medusajs/framework/utils";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  // Resolve the product module service
  const productModuleService = container.resolve(Modules.PRODUCT);

  // Fetch all products with status 'draft'
  const draftProducts = await productModuleService.listProducts(
    { status: "published" },
    { select: ["id"] }
  );
  console.log(`Found ${draftProducts.length} draft products.`);

  // Extract product IDs
  const draftProductIds = draftProducts.map((product) => product.id);

  // Delete the draft products
  if (draftProductIds.length > 0) {
    await productModuleService.deleteProducts(draftProductIds);

    res.json({
      deleted: draftProductIds,
      count: draftProductIds.length,
    });
  }
};
