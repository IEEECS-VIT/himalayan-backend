import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import twilioService from "../../../services/twilio.service";
import { container } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";
import otpStorageService from "../../../services/otp-storage.service";
import axios from "axios";

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
    console.log("isValid", isValid);  

    if (!isValid) {
      return res.status(400).send({ error: "Invalid OTP" });
    }

    // Store verification status in Redis for 5 minutes
    await otpStorageService.storeVerifiedOTP(phone);

    // Check if customer exists
    const customerModuleService = container.resolve(Modules.CUSTOMER);
    const [customers] = await customerModuleService.listAndCountCustomers();
    const customer = customers.find((c) => c.phone === phone);
    console.log("customer", customer);

    if (!customer) {
      // Return 404 to indicate user needs to sign up
      return res.status(404).send({
        message: "User not found",
        phone,
        requiresSignup: true
      });
    }

    // Get token using store API
    const authResponse = await axios.post(
      `${process.env.MEDUSA_BACKEND_URL || "http://localhost:8000"}/auth/customer/emailpass`,
      {
        email: customer.email,
        password: process.env.DEFAULT_CUSTOMER_PASSWORD
      }
    );

    // Return success with customer info and Medusa token
    res.send({
      message: "OTP verified successfully",
      customer,
      token: authResponse.data.token
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).send({ error: "Failed to verify OTP" });
  }
}
