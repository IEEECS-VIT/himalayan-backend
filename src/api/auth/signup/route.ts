import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { container } from "@medusajs/framework";
import { Modules } from "@medusajs/framework/utils";
import otpStorageService from "../../../services/otp-storage.service";
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";
import axios from "axios";

type SignupInput = {
  phone: string;
  email: string;
  first_name: string;
  last_name: string;
};

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { phone, email, first_name, last_name } = req.body as SignupInput;

  if (!phone || !email || !first_name || !last_name) {
    return res.status(400).send({ 
      error: "Phone, email, first name, and last name are required" 
    });
  }

  try {
    // Check if OTP was verified
    const isVerified = await otpStorageService.isOTPVerified(phone);
    if (!isVerified) {
      return res.status(401).send({ 
        error: "OTP verification required before signup" 
      });
    }

    // First register with email/password to get initial token
    const registerResponse = await axios.post(
      `${process.env.MEDUSA_BACKEND_URL || "http://localhost:8000"}/auth/customer/emailpass/register`,
      {
        email,
        password: process.env.DEFAULT_CUSTOMER_PASSWORD
      }
    );

    const initialToken = registerResponse.data.token;

    // Register customer with store API using the initial token
    const customerResponse = await axios.post(
      `${process.env.MEDUSA_BACKEND_URL || "http://localhost:8000"}/store/customers`,
      {
        email,
        first_name,
        last_name,
        phone
      },
      {
        headers: {
          'Authorization': `Bearer ${initialToken}`,
          'Content-Type': 'application/json',
          'x-publishable-api-key': process.env.MEDUSA_PUBLISHABLE_KEY
        }
      }
    );

    // Get final token by authenticating
    const finalAuthResponse = await axios.post(
      `${process.env.MEDUSA_BACKEND_URL || "http://localhost:8000"}/auth/customer/emailpass`,
      {
        email,
        password: process.env.DEFAULT_CUSTOMER_PASSWORD
      }
    );

    // Remove OTP verification from Redis
    await otpStorageService.removeVerifiedOTP(phone);

    // Return success with customer info and final token
    res.send({
      message: "Signup successful",
      customer: customerResponse.data,
      token: finalAuthResponse.data.token
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).send({ error: "Failed to complete signup" });
  }
} 