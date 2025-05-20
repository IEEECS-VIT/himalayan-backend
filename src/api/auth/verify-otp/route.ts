import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import twilioService from "../../../services/twilio.service";
import { container } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";
import jwt from "jsonwebtoken";

type VerifyOTPInput = {
  phone: string;
  otp: string;
};

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { phone, otp } = req.body as VerifyOTPInput;

  if (!phone || !otp) {
    return res.status(400).send({ error: "Phone number and OTP are required" });
  }

  try {
    // Verify OTP using Twilio
    const isValid = await twilioService.verifyOTP(phone, otp);

    if (!isValid) {
      return res.status(400).send({ error: "Invalid OTP" });
    }

    // Check if customer exists
    const customerModuleService = container.resolve(Modules.CUSTOMER);
    const [customers] = await customerModuleService.listAndCountCustomers();
    const customer = customers.find((c) => c.metadata?.phone === phone);

    if (!customer) {
      // Return 404 to indicate user needs to sign up
      return res.status(404).send({
        message: "User not found",
        phone,
      });
    }

    // Generate JWT token for authenticated user
    const token = jwt.sign(
      {
        phone,
        customer_id: customer.id,
      },
      process.env.JWT_SECRET || "super-secret-jwt-key",
      { expiresIn: "7d" }
    );

    res.send({
      message: "OTP verified successfully",
      token,
      customer,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).send({ error: "Failed to verify OTP" });
  }
} 
