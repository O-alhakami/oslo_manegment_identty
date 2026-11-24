import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthenticatedRequest } from "../types";

interface TokenPayload extends jwt.JwtPayload {
  sub: string;
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is required");
    }

    const payload = jwt.verify(token, secret);
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        payload.sub,
      )
    ) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

