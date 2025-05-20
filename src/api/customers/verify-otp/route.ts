import { container } from "@medusajs/framework";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";
import jwt from "jsonwebtoken";

type Input = {
  phone: string;
  otp: string;
};

// Reference to the same OTP store used in the otp-send route
interface OTPRecord {
  code: string;
  expiresAt: number;
}

const otpStore = new Map<string, OTPRecord>();

// JWT secret key - in production, this should be an environment variable
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { phone, otp } = req.body as Input;

  if (!phone || !otp) {
    return res.status(400).send({ error: "Phone number and OTP are required" });
  }

  // Verify OTP
  const otpRecord = otpStore.get(phone);
  if (!otpRecord) {
    return res.status(401).send({ error: "No OTP found for this phone number" });
  }
  
  // Check if OTP is expired
  if (Date.now() > otpRecord.expiresAt) {
    otpStore.delete(phone); // Clear expired OTP
    return res.status(401).send({ error: "OTP has expired. Please request a new one." });
  }
  
  // Check if OTP matches
  if (otpRecord.code !== otp) {
    return res.status(401).send({ error: "Invalid OTP" });
  }

  // OTP verified, clear it from store
  otpStore.delete(phone);

  try {
    // Check if customer exists with this phone number
    const customerModuleService = container.resolve(Modules.CUSTOMER);
    const [customers] = await customerModuleService.listAndCountCustomers();
    
    const customer = customers.find((customer) => {
      return customer.metadata?.phone === phone;
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        phone,
        customer_id: customer?.id || null
      }, 
      JWT_SECRET, 
      { 
        expiresIn: '1d' 
      }
    );

    if (customer) {
      // If customer exists, return customer info and token
      return res.send({
        success: true,
        exists: true,
        customer,
        token
      });
    } else {
      // If customer doesn't exist, return token for completing registration
      return res.status(202).send({
        success: true,
        exists: false,
        token,
        message: "User not found. Please complete registration."
      });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).send({ error: "Failed to verify OTP" });
  }
}