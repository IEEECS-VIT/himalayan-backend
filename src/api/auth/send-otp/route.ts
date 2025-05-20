import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import twilioService from "../../../services/twilio.service";
import rateLimitService from "../../../services/rate-limit.service";
import phoneValidationService from "../../../services/phone-validation.service";

type SendOTPInput = {
  phone: string;
};

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { phone } = req.body as SendOTPInput;

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

    // Use the formatted number returned by validation
    const formattedPhone = validationResult.formattedNumber || phone;

    // Check rate limiting
    const isRateLimited = await rateLimitService.isRateLimited(`send-otp:${formattedPhone}`);
    if (isRateLimited) {
      const timeToReset = await rateLimitService.getTimeToReset(`send-otp:${formattedPhone}`);
      return res.status(429).send({
        error: "Too many requests",
        timeToReset: Math.ceil(timeToReset / 1000), // Convert to seconds
      });
    }

    // Send OTP via Twilio Verify
    await twilioService.sendOTP(formattedPhone, "", 10); // 10 minutes expiry

    res.send({
      message: "OTP sent successfully",
      expiryMinutes: 10,
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).send({ error: "Failed to send OTP" });
  }
} 