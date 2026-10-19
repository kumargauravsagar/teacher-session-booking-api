import { z } from 'zod';
import { objectIdSchema, requiredString } from './common';

export const createUserSchema = z.object({
  fullName: requiredString('fullName').trim().min(1, 'fullName must not be empty'),
  email: requiredString('email').trim().toLowerCase().pipe(z.email('email must be a valid email address')),
  phone: requiredString('phone').trim().min(1, 'phone must not be empty'),
});

export const userIdParamSchema = z.object({ id: objectIdSchema('user id') });

export type CreateUserInput = z.infer<typeof createUserSchema>;
