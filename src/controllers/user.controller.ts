import { Request, Response } from 'express';
import * as sessionService from '../services/session.service';
import * as userService from '../services/user.service';
import { sendSuccess } from '../utils/response';
import { createUserSchema, userIdParamSchema } from '../validators/user.validator';
import { parseOrThrow } from '../validators/common';

export async function createUser(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(createUserSchema, req.body ?? {});
  const user = await userService.createUser(input);
  sendSuccess(res, 201, 'User created successfully', user);
}

export async function getUserSessions(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(userIdParamSchema, req.params);
  const data = await sessionService.getUserSessions(id);
  sendSuccess(res, 200, 'User sessions retrieved successfully', data);
}
