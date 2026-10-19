import { z } from 'zod';
import { objectIdSchema, requiredString } from './common';

const isoDate = (label: string) =>
  requiredString(label)
    .refine((v) => !Number.isNaN(new Date(v).getTime()), `${label} must be a valid date`)
    .transform((v) => new Date(v));

// Unknown keys (status, userId, completedAt ...) are stripped, so clients cannot set them.
export const createSessionSchema = z
  .object({
    teacherId: objectIdSchema('teacherId'),
    startTime: isoDate('startTime'),
    endTime: isoDate('endTime'),
  })
  // Zod 4 can run object-level refinements even when a field already failed, so guard the types.
  .refine((d) => !(d.startTime instanceof Date && d.endTime instanceof Date) || d.endTime.getTime() > d.startTime.getTime(), {
    message: 'endTime must be strictly later than startTime',
    path: ['endTime'],
  });

export const sessionIdParamSchema = z.object({ id: objectIdSchema('session id') });

export const bookSessionBodySchema = z.object({ userId: objectIdSchema('userId') });

/** dateTimestamp: Unix time in MILLISECONDS, digits only. */
export const availableQuerySchema = z.object({
  dateTimestamp: requiredString('dateTimestamp')
    .regex(/^\d{1,16}$/, 'dateTimestamp must be a non-negative integer (Unix milliseconds)')
    .transform(Number)
    .refine((n) => !Number.isNaN(new Date(n).getTime()), 'dateTimestamp is out of the valid date range'),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
