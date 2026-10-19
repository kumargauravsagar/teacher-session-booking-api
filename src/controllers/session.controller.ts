import { Request, Response } from 'express';
import * as sessionService from '../services/session.service';
import { sendSuccess } from '../utils/response';
import { parseOrThrow } from '../validators/common';
import {
  availableQuerySchema,
  bookSessionBodySchema,
  createSessionSchema,
  sessionIdParamSchema,
} from '../validators/session.validator';

export async function createSession(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(createSessionSchema, req.body ?? {});
  const session = await sessionService.createSession(input);
  sendSuccess(res, 201, 'Session created successfully', session);
}

export async function getAvailableSessions(req: Request, res: Response): Promise<void> {
  const { dateTimestamp } = parseOrThrow(availableQuerySchema, req.query);
  const sessions = await sessionService.getAvailableSessions(dateTimestamp);
  sendSuccess(res, 200, 'Available sessions retrieved successfully', sessions);
}

export async function bookSession(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(sessionIdParamSchema, req.params);
  const { userId } = parseOrThrow(bookSessionBodySchema, req.body ?? {});
  const session = await sessionService.bookSession(id, userId);
  sendSuccess(res, 200, 'Session booked successfully', session);
}

export async function completeSession(req: Request, res: Response): Promise<void> {
  const { id } = parseOrThrow(sessionIdParamSchema, req.params);
  const session = await sessionService.completeSession(id);
  sendSuccess(res, 200, 'Session marked as completed', session);
}
