import { z } from 'zod';
import { ApiError } from '../utils/ApiError';

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

/** A string field with distinct messages for "missing" and "wrong type". */
export const requiredString = (label: string) =>
  z.string({
    error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be a string`),
  });

export const objectIdSchema = (label: string) =>
  requiredString(label).regex(OBJECT_ID_REGEX, `${label} must be a valid ObjectId`);

/** Parses data with a Zod schema and throws ApiError(400) with a readable message on failure. */
export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
      .join('; ');
    throw ApiError.badRequest(message);
  }
  return result.data;
}
