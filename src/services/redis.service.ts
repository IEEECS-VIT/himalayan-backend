import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

class RedisService {
  private client: Redis;
  
  constructor() {
    this.client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    
    this.client.on("error", (err) => {
      console.error("Redis error:", err);
    });
    
    this.client.on("connect", () => {
      console.log("Connected to Redis");
    });
  }
  
  // Store OTP with expiration time
  async storeOTP(phone: string, otp: string, expiryMinutes: number): Promise<void> {
    const key = `otp:${phone}`;
    await this.client.set(key, otp);
    await this.client.expire(key, expiryMinutes * 60); // Convert minutes to seconds
  }
  
  // Get OTP for verification
  async getOTP(phone: string): Promise<string | null> {
    const key = `otp:${phone}`;
    return await this.client.get(key);
  }
  
  // Delete OTP after verification
  async deleteOTP(phone: string): Promise<void> {
    const key = `otp:${phone}`;
    await this.client.del(key);
  }
}

// Create a singleton instance
const redisService = new RedisService();
export default redisService;