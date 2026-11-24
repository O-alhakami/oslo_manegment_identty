import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export type VaultCategory = "password" | "identity" | "note";

