import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

class RateLimitService {
  private client: Redis;
  private windowSizeMs: number;
  private maxRequests: number;
  
  constructor() {
    this.client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
   
    this.windowSizeMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 600000);
    this.maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 5);
  }
  
  async isRateLimited(key: string): Promise<boolean> {
    const currentTime = Date.now();
    const redisKey = `rate-limit:${key}`;
    
    // Get all requests in the current window
    const requests = await this.client.zrangebyscore(
      redisKey,
      currentTime - this.windowSizeMs,
      currentTime
    );
    
    // Check if the number of requests exceeds the limit
    if (requests.length >= this.maxRequests) {
      return true;
    }
    
    // Add the current request timestamp
    await this.client.zadd(redisKey, currentTime, `${currentTime}-${Math.random()}`);
    
    // Set expiration for the set (to clean up old entries)
    await this.client.expire(redisKey, Math.ceil(this.windowSizeMs / 1000) * 2);
    
    return false;
  }
  
  async getTimeToReset(key: string): Promise<number> {
    const currentTime = Date.now();
    const redisKey = `rate-limit:${key}`;
    
    // Get the oldest request in the current window
    const oldestRequest = await this.client.zrange(redisKey, 0, 0, "WITHSCORES");
    
    if (oldestRequest.length < 2) {
      return 0;
    }
    
    const oldestTimestamp = parseInt(oldestRequest[1]);
    const resetTime = oldestTimestamp + this.windowSizeMs - currentTime;
    
    return Math.max(0, resetTime);
  }
}

// Create a singleton instance
const rateLimitService = new RateLimitService();
export default rateLimitService;