import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

class TwilioService {
  private client: twilio.Twilio;
  private phoneNumber: string;
  
  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials are not configured");
    }
    
    this.client = twilio(accountSid, authToken);
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER || "";
    
    if (!this.phoneNumber) {
      throw new Error("Twilio phone number is not configured");
    }
  }
  
  async sendSMS(to: string, body: string): Promise<void> {
    try {
      // Make sure phone number is in E.164 format (e.g., +1234567890)
      const formattedPhone = this.formatPhoneNumber(to);
      
      await this.client.messages.create({
        body,
        from: this.phoneNumber,
        to: formattedPhone
      });
      
      console.log(`SMS sent to ${formattedPhone}`);
    } catch (error) {
      console.error("Error sending SMS:", error);
      throw error;
    }
  }
  
  private formatPhoneNumber(phone: string): string {
    // Basic formatting to ensure E.164 format
   
    if (!phone.startsWith('+')) {
      return `+${phone}`;
    }
    return phone;
  }
  
  async sendOTP(phone: string, otp: string, expiryMinutes: number): Promise<void> {
    const message = `Your verification code is ${otp}. It expires in ${expiryMinutes} minutes.`;
    await this.sendSMS(phone, message);
  }
}

// Create a singleton instance
const twilioService = new TwilioService();
export default twilioService;