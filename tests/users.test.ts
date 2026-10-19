import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { User } from '../src/models/user.model';
import { clearDb, setupDb, teardownDb } from './setup';

const app = createApp();
const validUser = { fullName: 'Rahul Sharma', email: 'rahul@example.com', phone: '9876543210' };

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(clearDb);

describe('POST /users', () => {
  it('creates a valid user (201) with id and timestamps, normalising email', async () => {
    const res = await request(app).post('/users').send({ ...validUser, email: '  Rahul@Example.COM ' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toMatch(/^[a-f0-9]{24}$/);
    expect(res.body.data.email).toBe('rahul@example.com');
    expect(res.body.data.createdAt).toBeTruthy();
    expect(res.body.data.updatedAt).toBeTruthy();
    expect(res.body.data._id).toBeUndefined();
    expect(await User.countDocuments()).toBe(1);
  });

  it('rejects a missing name', async () => {
    const res = await request(app).post('/users').send({ email: validUser.email, phone: validUser.phone });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an empty name', async () => {
    const res = await request(app).post('/users').send({ ...validUser, fullName: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/users').send({ ...validUser, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing phone number', async () => {
    const res = await request(app).post('/users').send({ fullName: validUser.fullName, email: validUser.email });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email (409), including case differences', async () => {
    await request(app).post('/users').send(validUser).expect(201);
    const res = await request(app).post('/users').send({ ...validUser, email: 'RAHUL@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for malformed JSON without crashing', async () => {
    const res = await request(app).post('/users').set('Content-Type', 'application/json').send('{"fullName": ');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
