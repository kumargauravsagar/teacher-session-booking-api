import { NextFunction, Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

interface MongoDuplicateKeyError extends Error {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return err instanceof Error && (err as MongoDuplicateKeyError).code === 11000;
}

function isBodyParserError(err: unknown): err is Error & { type: string; status: number } {
  return err instanceof Error && typeof (err as { type?: unknown }).type === 'string' && (err as { status?: unknown }).status === 400;
}

// Must be registered after all routes. Never leaks stack traces or internals to clients.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let message = 'Internal server error';

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (isDuplicateKeyError(err)) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern ?? {})[0];
    message = field === 'email' ? 'A user with this email already exists' : 'Duplicate value violates a unique constraint';
  } else if (err instanceof MongooseError.ValidationError) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  } else if (err instanceof MongooseError.CastError) {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  } else if (isBodyParserError(err)) {
    statusCode = 400;
    message = err.type === 'entity.parse.failed' ? 'Malformed JSON in request body' : 'Invalid request body';
  } else if (err instanceof Error && err.message.includes('must have a user')) {
    statusCode = 400;
    message = err.message;
  }

  if (statusCode === 500) {
    console.error(err);
    if (env.nodeEnv !== 'production' && err instanceof Error) message = `Internal server error: ${err.message}`;
  }

  res.status(statusCode).json({ success: false, message });
}
