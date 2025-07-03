// src/api/admin/customers/search-delete/route.ts
import type {
    Request as
        MedusaRequest,
} from "express"
import type { Response as MedusaResponse } from "express"



// GET endpoint to search customer by phone number
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const customerService = req.scope.resolve("customerService")
    const { phone } = req.query

  if (!phone) {
    return res.status(400).json({
      error: "Phone number is required"
    })
  }

  // Search for customer by phone number using listAndCount method
  const [customers, count] = await customerService.listAndCount({
    phone: phone as string
  })

  if (count === 0) {
    return res.status(404).json({
      message: "No customer found with this phone number",
      phone: phone
    })
  }

  // Return customer(s) found
  return res.json({
    customers: customers,
    count: count
  })
} catch (error) {
  console.error("Error searching customer:", error)
  return res.status(500).json({
    error: "Failed to search customer",
    details: error.message
  })
}
}

// DELETE endpoint to delete customer by phone number
export const DELETE = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    const customerService = req.scope.resolve("customerService")
    const { phone } = req.query

    if (!phone) {
      return res.status(400).json({
        error: "Phone number is required"
      })
    }

    // First, find the customer by phone number
    const [customers, count] = await customerService.listAndCount({
      phone: phone as string
    })

    if (count === 0) {
      return res.status(404).json({
        error: "No customer found with this phone number",
        phone: phone
      })
    }

    if (count > 1) {
      return res.status(400).json({
        error: "Multiple customers found with this phone number. Please specify customer ID.",
        customers: customers.map(c => ({ id: c.id, email: c.email, phone: c.phone }))
      })
    }

    const customer = customers[0]

    // Delete the customer permanently
    await customerService.delete(customer.id)

    return res.json({
      message: "Customer deleted successfully",
      deleted_customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        first_name: customer.first_name,
        last_name: customer.last_name
      }
    })
  } catch (error) {
    console.error("Error deleting customer:", error)
    return res.status(500).json({
      error: "Failed to delete customer",
      details: error.message
    })
  }
}