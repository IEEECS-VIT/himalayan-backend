import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

class OTPStorageService {
  private client: Redis;
  private isConnected: boolean = false;
  
  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    
    this.client = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });
    
    this.client.on("error", (err) => {
      console.error("Redis error in OTP storage service:", err);
      this.isConnected = false;
    });
    
    this.client.on("connect", () => {
      console.log("OTP storage service connected to Redis");
      this.isConnected = true;
    });

    this.client.on("ready", () => {
      console.log("OTP storage service Redis client ready");
      this.isConnected = true;
    });
  }
  
  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Redis client is not connected");
    }
  }

  async storeVerifiedOTP(phone: string): Promise<void> {
    try {
      await this.ensureConnection();
      const key = `otp-verified:${phone}`;
      // Store for 5 minutes
      await this.client.set(key, "verified", "EX", 300);
    } catch (error) {
      console.error("Error storing verified OTP:", error);
      throw new Error("Failed to store verified OTP");
    }
  }

  async isOTPVerified(phone: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      const key = `otp-verified:${phone}`;
      const value = await this.client.get(key);
      return value === "verified";
    } catch (error) {
      console.error("Error checking OTP verification:", error);
      throw new Error("Failed to check OTP verification");
    }
  }

  async removeVerifiedOTP(phone: string): Promise<void> {
    try {
      await this.ensureConnection();
      const key = `otp-verified:${phone}`;
      await this.client.del(key);
    } catch (error) {
      console.error("Error removing verified OTP:", error);
      throw new Error("Failed to remove verified OTP");
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
    } catch (error) {
      console.error("Error closing Redis connection:", error);
      throw new Error("Failed to close Redis connection");
    }
  }
}

// Create a singleton instance
const otpStorageService = new OTPStorageService();
export default otpStorageService; 