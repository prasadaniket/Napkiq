import { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the full error server-side, but never leak internal messages/stack
  // (Prisma/pg errors expose table, column and constraint details) to clients.
  console.error(`[Error] ${err.message}`, err.stack)
  res.status(500).json({ error: 'Internal server error' })
}
