import { Router } from 'express';
import * as sessionController from '../controllers/session.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/', asyncHandler(sessionController.createSession));
// Must be registered before any "/:id" route so "available" is not treated as an id.
router.get('/available', asyncHandler(sessionController.getAvailableSessions));
router.post('/:id/book', asyncHandler(sessionController.bookSession));
router.patch('/:id/complete', asyncHandler(sessionController.completeSession));

export default router;
