import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function POST(req, res) {
  try {
    const { pincode } = req.body;
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        error: "Invalid pincode. It must be a 6-digit number.",
      });
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

    const { data: stockLocations } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name", "address.*", "sales_channels.*"],
    });
    console.log("Stock Locations:", stockLocations);
    const filteredLocations = stockLocations.filter(
      (location) => location.address?.postal_code == pincode
    );
    console.log("Filtered Locations:", filteredLocations);
    if (filteredLocations.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No stock locations found for the provided pincode.",
      });
    } 
    return res.status(200).json({
      success: true,
      count: filteredLocations.length,
      locations: filteredLocations[0].sales_channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
      })),
    });
  } catch (error) {
    console.error("Error fetching stock locations:", error);

    return res.status(500).json({
      success: false,
      error: "Internal server error. Please try again later. " + error,
    });
  }
}
