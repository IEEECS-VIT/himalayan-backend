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

    // Create auth identity for phone
    const authModuleService = container.resolve(Modules.AUTH);
    const authIdentity = await authModuleService.createAuthIdentities({
      provider_identities: [
        {
          provider: "phone",
          entity_id: phone,
        },
      ],
    });

    // Create customer account using workflow
    const { result } = await createCustomerAccountWorkflow(req.scope).run({
      input: {
        authIdentityId: authIdentity.id,
        customerData: {
          first_name,
          last_name,
          email,
          phone
        },
      },
    });

    // Get token using store API
    const authResponse = await axios.post(
      `${process.env.MEDUSA_BACKEND_URL || "http://localhost:8000"}/auth/customer/emailpass/register`,
      {
        email,
        password: process.env.DEFAULT_CUSTOMER_PASSWORD
      }
    );

    // Remove OTP verification from Redis
    await otpStorageService.removeVerifiedOTP(phone);

    // Return success with customer info and token
    res.send({
      message: "Signup successful",
      ...result,
      token: authResponse.data.token
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).send({ error: "Failed to complete signup" });
  }
} 