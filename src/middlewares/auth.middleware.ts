import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key";

export interface AuthenticatedRequest extends MedusaRequest {
  user?: {
    phone: string;
    customer_id: string | null;
  };
}

export function authenticateJWT(req: AuthenticatedRequest, res: MedusaResponse, next: () => void) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ error: "Authorization header required" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ error: "Authorization token required" });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as { phone: string; customer_id: string | null };
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).send({ error: "Invalid or expired token" });
  }
}

// For routes that require authentication and a registered customer
export function requireCustomer(req: AuthenticatedRequest, res: MedusaResponse, next: () => void) {
  if (!req.user) {
    return res.status(401).send({ error: "Authentication required" });
  }

  if (!req.user.customer_id) {
    return res.status(403).send({ error: "Customer registration required" });
  }

  next();
}