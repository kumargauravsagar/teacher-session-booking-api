import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/', asyncHandler(userController.createUser));
router.get('/:id/sessions', asyncHandler(userController.getUserSessions));

export default router;
