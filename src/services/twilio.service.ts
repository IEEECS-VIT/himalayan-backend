import twilio from "twilio";
import dotenv from "dotenv";
import { TwilioError } from "./errors";

dotenv.config();

class TwilioService {
  private client: twilio.Twilio;
  private verifyServiceSid: string;
  
  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || "";
    
    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials are not configured");
    }
    
    if (!this.verifyServiceSid) {
      throw new Error("Twilio Verify Service SID is not configured");
    }
    
    this.client = twilio(accountSid, authToken);
  }
  
  private async validateAndFormatPhoneNumber(phone: string): Promise<string> {
    try {
      // Ensure phone number is in E.164 format
      const formattedPhone = this.formatPhoneNumber(phone);
      
      // Validate phone number using Twilio's Lookup API
      const lookup = await this.client.lookups.v2.phoneNumbers(formattedPhone).fetch();
      
      if (!lookup.valid) {
        throw new TwilioError("Invalid phone number", "INVALID_PHONE");
      }
      
      return lookup.phoneNumber;
    } catch (error) {
      if (error instanceof TwilioError) {
        throw error;
      }
      throw new TwilioError("Failed to validate phone number", "PHONE_VALIDATION_ERROR");
    }
  }
  
  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    return cleaned;
  }
  
  async sendOTP(phone: string, otp: string, expiryMinutes: number): Promise<void> {
    try {
      // Validate and format phone number
      const formattedPhone = await this.validateAndFormatPhoneNumber(phone);
      
      // Send verification code using Twilio Verify
      const verification = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({
          to: formattedPhone,
          channel: "sms"
        });
      
      if (verification.status !== "pending") {
        throw new TwilioError(`Failed to send verification: ${verification.status}`, "VERIFY_SEND_ERROR");
      }
      
      console.log(`Verification sent to ${formattedPhone} with SID: ${verification.sid}`);
    } catch (error) {
      if (error instanceof TwilioError) {
        throw error;
      }
      console.error("Error sending verification:", error);
      throw new TwilioError("Failed to send verification", "VERIFY_SEND_ERROR");
    }
  }

  async verifyOTP(phone: string, code: string): Promise<boolean> {
    try {
      const formattedPhone = await this.validateAndFormatPhoneNumber(phone);
      
      const verificationCheck = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({
          to: formattedPhone,
          code: code
        });
      
      return verificationCheck.status === "approved";
    } catch (error) {
      console.error("Error checking verification:", error);
      throw new TwilioError("Failed to check verification", "VERIFY_CHECK_ERROR");
    }
  }
}

// Create a singleton instance
const twilioService = new TwilioService();
export default twilioService;