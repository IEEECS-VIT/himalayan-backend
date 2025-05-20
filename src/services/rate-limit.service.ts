import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

class RateLimitService {
  private client: Redis;
  private windowSizeMs: number;
  private maxRequests: number;
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
      console.error("Redis error in rate limit service:", err);
      this.isConnected = false;
    });
    
    this.client.on("connect", () => {
      console.log("Rate limit service connected to Redis");
      this.isConnected = true;
    });

    this.client.on("ready", () => {
      console.log("Rate limit service Redis client ready");
      this.isConnected = true;
    });
   
    this.windowSizeMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 600000); // 10 minutes default
    this.maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 5); // 5 requests per window default
  }
  
  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      throw new RateLimitError("Redis client is not connected");
    }
  }
  
  async isRateLimited(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      
      const currentTime = Date.now();
      const redisKey = `rate-limit:${key}`;
      
      // Use Redis transaction to ensure atomicity
      const multi = this.client.multi();
      
      // Get all requests in the current window
      multi.zrangebyscore(
        redisKey,
        currentTime - this.windowSizeMs,
        currentTime
      );
      
      // Add the current request timestamp
      multi.zadd(redisKey, currentTime, `${currentTime}-${Math.random()}`);
      
      // Set expiration for the set
      multi.expire(redisKey, Math.ceil(this.windowSizeMs / 1000) * 2);
      
      const results = await multi.exec();
      
      if (!results) {
        throw new RateLimitError("Failed to execute rate limit check");
      }
      
      const requests = results[0][1] as string[];
      
      // Check if the number of requests exceeds the limit
      return requests.length >= this.maxRequests;
    } catch (error) {
      console.error("Error checking rate limit:", error);
      throw new RateLimitError("Failed to check rate limit");
    }
  }
  
  async getTimeToReset(key: string): Promise<number> {
    try {
      await this.ensureConnection();
      
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
    } catch (error) {
      console.error("Error getting time to reset:", error);
      throw new RateLimitError("Failed to get time to reset");
    }
  }

  // Gracefully close the Redis connection
  async close(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
    } catch (error) {
      console.error("Error closing Redis connection:", error);
      throw new RateLimitError("Failed to close Redis connection");
    }
  }
}

// Create a singleton instance
const rateLimitService = new RateLimitService();
export default rateLimitService;