import { container } from "@medusajs/framework";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

type Input = {
  phone: string;
};

// Store OTPs with expiration times
interface OTPRecord {
  code: string;
  expiresAt: number;
}

const otpStore = new Map<string, OTPRecord>();
const OTP_EXPIRY_MINUTES = 10; // OTP valid for 10 minutes

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { phone } = req.body as Input;

  if (!phone) {
    return res.status(400).send({ error: "Phone number is required" });
  }

  try {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiration time (current time + expiry minutes)
    const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);
    otpStore.set(phone, { code: otp, expiresAt });
    
    //  would be using twilio later
    console.log(`OTP for ${phone}: ${otp} (expires in ${OTP_EXPIRY_MINUTES} minutes)`);
    
    
    
    res.send({ 
      success: true, 
      message: `OTP sent successfully. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
      otp: otp, // should be removed later
      expiresAt: expiresAt // should be removed later
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).send({ error: "Failed to send OTP" });
  }
}