import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

class PhoneValidationService {
  private client: twilio.Twilio;
  
  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials are not configured");
    }
    
    this.client = twilio(accountSid, authToken);
  }
  
  /**
   * Validates a phone number using Twilio's Lookup API
   * @param phone The phone number to validate
   * @returns An object with validation results
   */
  async validatePhoneNumber(phone: string): Promise<{
    valid: boolean;
    formattedNumber?: string;
    countryCode?: string;
    carrier?: any;
    error?: string;
  }> {
    try {
      // Add the + prefix if not present
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
      
      // Use Twilio's Lookup API v1 to validate the phone number and get carrier info
      const result = await this.client.lookups.phoneNumbers(formattedPhone)
        .fetch({ type: ['carrier'] });
      
      return {
        valid: true,
        formattedNumber: result.phoneNumber,
        countryCode: result.countryCode,
        carrier: result.carrier
      };
    } catch (error: any) {
      console.error("Error validating phone number:", error);
      
      return {
        valid: false,
        error: error.message
      };
    }
  }
  
  /**
   * Checks if a phone number is a mobile phone
   * @param phone The phone number to check
   * @returns Whether the number is a mobile phone
   */
  async isMobilePhone(phone: string): Promise<boolean> {
    const result = await this.validatePhoneNumber(phone);
    
    if (!result.valid) {
      return false;
    }

    return result.carrier?.type === 'mobile';
  }
}

// Create a singleton instance
const phoneValidationService = new PhoneValidationService();
export default phoneValidationService;