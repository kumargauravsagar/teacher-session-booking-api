import express, { Application } from 'express';
import { errorHandler } from './middlewares/error.middleware';
import { notFoundHandler } from './middlewares/not-found.middleware';
import sessionRoutes from './routes/session.routes';
import userRoutes from './routes/user.routes';

export function createApp(): Application {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, message: 'OK', data: { status: 'up' } });
  });

  app.use('/users', userRoutes);
  app.use('/sessions', sessionRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
