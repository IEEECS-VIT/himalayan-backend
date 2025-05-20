import { container } from "@medusajs/framework";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import dotenv from "dotenv";
import redisService from "../../../services/redis.service";
import twilioService from "../../../services/twilio.service";
import rateLimitService from "../../../services/rate-limit.service";
import phoneValidationService from "../../../services/phone-validation.service";

dotenv.config();

type Input = {
  phone: string;
};

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { phone } = req.body as Input;

  if (!phone) {
    return res.status(400).send({ error: "Phone number is required" });
  }

  try {
    // Validate phone number
    const validationResult = await phoneValidationService.validatePhoneNumber(phone);
    
    if (!validationResult.valid) {
      return res.status(400).send({ 
        error: "Invalid phone number",
        details: validationResult.error
      });
    }
    
    // Use the formatted number returned by Twilio
    const formattedPhone = validationResult.formattedNumber || phone;
    
   
    const validateMobile = process.env.VALIDATE_MOBILE_ONLY === 'true';
    if (validateMobile) {
      const isMobile = await phoneValidationService.isMobilePhone(formattedPhone);
      if (!isMobile) {
        return res.status(400).send({ 
          error: "SMS verification requires a mobile phone number"
        });
      }
    }
    
    // Check rate limiting
    const isLimited = await rateLimitService.isRateLimited(`otp:${formattedPhone}`);
    if (isLimited) {
      const timeToReset = await rateLimitService.getTimeToReset(`otp:${formattedPhone}`);
      const minutesToReset = Math.ceil(timeToReset / 60000);
      
      return res.status(429).send({ 
        error: `Too many OTP requests. Please try again in ${minutesToReset} minute(s).`,
        retryAfter: timeToReset
      });
    }
    
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
   
    const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);
    
    // Store OTP in Redis with expiration
    await redisService.storeOTP(formattedPhone, otp, OTP_EXPIRY_MINUTES);
    
    // Send OTP via Twilio
    await twilioService.sendOTP(formattedPhone, otp, OTP_EXPIRY_MINUTES);
    
    if (process.env.NODE_ENV === "development") {
      console.log(`OTP for ${formattedPhone}: ${otp} (expires in ${OTP_EXPIRY_MINUTES} minutes)`);
    }
    
    res.send({ 
      success: true, 
      message: `OTP sent successfully. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
      formattedPhone, 
      // Include OTP in response only in development environment
      ...(process.env.NODE_ENV === "development" && { otp })
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).send({ error: "Failed to send OTP" });
  }
}