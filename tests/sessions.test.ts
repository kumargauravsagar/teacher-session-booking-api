import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { ISession, Session } from '../src/models/session.model';
import { Teacher } from '../src/models/teacher.model';
import { User } from '../src/models/user.model';
import { clearDb, setupDb, teardownDb } from './setup';

const app = createApp();

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(clearDb);

const HOUR = 3600 * 1000;
const futureStart = (offsetHours = 48) => new Date(Date.now() + offsetHours * HOUR);

async function makeTeacher() {
  return Teacher.create({ fullName: 'Anita Verma', email: 'anita@example.com', specialization: 'Maths', experience: 8 });
}
async function makeUser(email = 'u1@example.com') {
  return User.create({ fullName: 'User One', email, phone: '9999999999' });
}
async function makeSession(teacherId: Types.ObjectId, start = futureStart(), extra: Partial<ISession> = {}) {
  const session = new Session({ teacherId, startTime: start, endTime: new Date(start.getTime() + HOUR), ...extra });
  return session.save();
}
const stageNames = (call: unknown): string[] => (call as Record<string, unknown>[]).map((s) => Object.keys(s)[0]);
const randomId = () => new mongoose.Types.ObjectId().toString();

describe('POST /sessions', () => {
  it('creates a session with default AVAILABLE status and no user', async () => {
    const teacher = await makeTeacher();
    const res = await request(app).post('/sessions').send({
      teacherId: String(teacher._id),
      startTime: '2026-11-01T10:00:00.000Z',
      endTime: '2026-11-01T11:00:00.000Z',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('AVAILABLE');
    expect(res.body.data.userId).toBeNull();
    expect(res.body.data.startTime).toBe('2026-11-01T10:00:00.000Z');
  });

  it('ignores client-supplied status/userId/completedAt', async () => {
    const teacher = await makeTeacher();
    const res = await request(app).post('/sessions').send({
      teacherId: String(teacher._id),
      startTime: '2026-11-01T10:00:00.000Z',
      endTime: '2026-11-01T11:00:00.000Z',
      status: 'BOOKED',
      userId: randomId(),
      completedAt: new Date().toISOString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('AVAILABLE');
    expect(res.body.data.userId).toBeNull();
    expect(res.body.data.completedAt).toBeNull();
  });

  it('returns 404 for a nonexistent teacher', async () => {
    const res = await request(app).post('/sessions').send({
      teacherId: randomId(),
      startTime: '2026-11-01T10:00:00.000Z',
      endTime: '2026-11-01T11:00:00.000Z',
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid teacher id', async () => {
    const res = await request(app).post('/sessions').send({
      teacherId: 'abc',
      startTime: '2026-11-01T10:00:00.000Z',
      endTime: '2026-11-01T11:00:00.000Z',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid or missing dates', async () => {
    const teacher = await makeTeacher();
    const teacherId = String(teacher._id);
    expect((await request(app).post('/sessions').send({ teacherId, startTime: 'garbage', endTime: '2026-11-01T11:00:00.000Z' })).status).toBe(400);
    expect((await request(app).post('/sessions').send({ teacherId, startTime: '2026-11-01T10:00:00.000Z' })).status).toBe(400);
  });

  it('returns 400 when endTime is earlier than or equal to startTime', async () => {
    const teacher = await makeTeacher();
    const teacherId = String(teacher._id);
    const earlier = await request(app).post('/sessions').send({ teacherId, startTime: '2026-11-01T11:00:00.000Z', endTime: '2026-11-01T10:00:00.000Z' });
    const equal = await request(app).post('/sessions').send({ teacherId, startTime: '2026-11-01T10:00:00.000Z', endTime: '2026-11-01T10:00:00.000Z' });
    expect(earlier.status).toBe(400);
    expect(equal.status).toBe(400);
    expect(await Session.countDocuments()).toBe(0);
  });
});

describe('GET /sessions/available', () => {
  it('returns only AVAILABLE sessions of the requested UTC day, with safe teacher details', async () => {
    const teacher = await makeTeacher();
    const user = await makeUser();
    const day = Date.UTC(2026, 10, 1, 0, 0, 0);
    const available = await makeSession(teacher._id, new Date(day + 10 * HOUR));
    await makeSession(teacher._id, new Date(day + 12 * HOUR), { status: 'BOOKED', userId: user._id });
    await makeSession(teacher._id, new Date(day + 14 * HOUR), { status: 'COMPLETED', userId: user._id, completedAt: new Date() });
    await makeSession(teacher._id, new Date(day + 24 * HOUR + 1)); // next UTC day
    await makeSession(teacher._id, new Date(day - 1)); // previous UTC day

    // Any timestamp within the day (here 23:59:59.999 UTC) selects the same day.
    const res = await request(app).get(`/sessions/available?dateTimestamp=${day + 24 * HOUR - 1}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(String(available._id));
    expect(res.body.data[0].status).toBe('AVAILABLE');
    expect(res.body.data[0].teacher).toEqual({
      id: String(teacher._id),
      fullName: 'Anita Verma',
      specialization: 'Maths',
      experience: 8,
    });
    expect(res.body.data[0].teacher.email).toBeUndefined();
  });

  it('includes sessions starting exactly at UTC midnight and excludes the next midnight', async () => {
    const teacher = await makeTeacher();
    const day = Date.UTC(2026, 10, 1);
    await makeSession(teacher._id, new Date(day));
    await makeSession(teacher._id, new Date(day + 24 * HOUR));
    const res = await request(app).get(`/sessions/available?dateTimestamp=${day}`);
    expect(res.body.data).toHaveLength(1);
  });

  it('sorts by startTime ascending', async () => {
    const teacher = await makeTeacher();
    const day = Date.UTC(2026, 10, 1);
    await makeSession(teacher._id, new Date(day + 15 * HOUR));
    await makeSession(teacher._id, new Date(day + 9 * HOUR));
    const res = await request(app).get(`/sessions/available?dateTimestamp=${day}`);
    const starts = res.body.data.map((s: { startTime: string }) => s.startTime);
    expect(starts).toEqual([...starts].sort());
  });

  it('returns an empty array (200) when nothing matches', async () => {
    const res = await request(app).get(`/sessions/available?dateTimestamp=${Date.UTC(2030, 0, 1)}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('rejects missing and invalid timestamps with 400', async () => {
    expect((await request(app).get('/sessions/available')).status).toBe(400);
    expect((await request(app).get('/sessions/available?dateTimestamp=abc')).status).toBe(400);
    expect((await request(app).get('/sessions/available?dateTimestamp=-5')).status).toBe(400);
    expect((await request(app).get('/sessions/available?dateTimestamp=1.5')).status).toBe(400);
    expect((await request(app).get('/sessions/available?dateTimestamp=9999999999999999')).status).toBe(400);
  });

  it('uses the MongoDB aggregation pipeline (and not find)', async () => {
    const aggregateSpy = vi.spyOn(Session, 'aggregate');
    const findSpy = vi.spyOn(Session, 'find');
    await request(app).get(`/sessions/available?dateTimestamp=${Date.UTC(2026, 10, 1)}`).expect(200);
    expect(aggregateSpy).toHaveBeenCalledTimes(1);
    const stages = stageNames(aggregateSpy.mock.calls[0][0]);
    expect(stages).toEqual(expect.arrayContaining(['$match', '$lookup', '$unwind', '$project', '$sort']));
    expect(findSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('POST /sessions/:id/book', () => {
  it('books an available session, updating status and userId together', async () => {
    const teacher = await makeTeacher();
    const user = await makeUser();
    const session = await makeSession(teacher._id);
    const res = await request(app).post(`/sessions/${session._id}/book`).send({ userId: String(user._id) });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('BOOKED');
    expect(res.body.data.userId).toBe(String(user._id));
    const stored = await Session.findById(session._id);
    expect(stored?.status).toBe('BOOKED');
    expect(String(stored?.userId)).toBe(String(user._id));
  });

  it('rejects a nonexistent user (404) without modifying the session', async () => {
    const teacher = await makeTeacher();
    const session = await makeSession(teacher._id);
    const res = await request(app).post(`/sessions/${session._id}/book`).send({ userId: randomId() });
    expect(res.status).toBe(404);
    expect((await Session.findById(session._id))?.status).toBe('AVAILABLE');
  });

  it('rejects a nonexistent session (404)', async () => {
    const user = await makeUser();
    const res = await request(app).post(`/sessions/${randomId()}/book`).send({ userId: String(user._id) });
    expect(res.status).toBe(404);
  });

  it('rejects invalid ids and missing userId (400)', async () => {
    const user = await makeUser();
    expect((await request(app).post('/sessions/not-an-id/book').send({ userId: String(user._id) })).status).toBe(400);
    expect((await request(app).post(`/sessions/${randomId()}/book`).send({ userId: 'bad' })).status).toBe(400);
    expect((await request(app).post(`/sessions/${randomId()}/book`).send({})).status).toBe(400);
  });

  it('rejects a second booking attempt (409) and keeps the first user', async () => {
    const teacher = await makeTeacher();
    const u1 = await makeUser('a@example.com');
    const u2 = await makeUser('b@example.com');
    const session = await makeSession(teacher._id);
    await request(app).post(`/sessions/${session._id}/book`).send({ userId: String(u1._id) }).expect(200);
    const res = await request(app).post(`/sessions/${session._id}/book`).send({ userId: String(u2._id) });
    expect(res.status).toBe(409);
    expect(String((await Session.findById(session._id))?.userId)).toBe(String(u1._id));
  });

  it('rejects booking a completed session (409)', async () => {
    const teacher = await makeTeacher();
    const user = await makeUser();
    const session = await makeSession(teacher._id, futureStart(), { status: 'COMPLETED', userId: user._id, completedAt: new Date() });
    const res = await request(app).post(`/sessions/${session._id}/book`).send({ userId: String(user._id) });
    expect(res.status).toBe(409);
  });

  it('allows at most one success for concurrent booking attempts', async () => {
    const teacher = await makeTeacher();
    const users = await Promise.all(Array.from({ length: 10 }, (_, i) => makeUser(`c${i}@example.com`)));
    const session = await makeSession(teacher._id);
    const results = await Promise.all(
      users.map((u) => request(app).post(`/sessions/${session._id}/book`).send({ userId: String(u._id) })),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    const winner = results.find((r) => r.status === 200)!;
    expect(String((await Session.findById(session._id))?.userId)).toBe(winner.body.data.userId);
  });
});

describe('PATCH /sessions/:id/complete', () => {
  it('completes a BOOKED session with a server-generated completedAt and preserves associations', async () => {
    const teacher = await makeTeacher();
    const user = await makeUser();
    const session = await makeSession(teacher._id, futureStart(), { status: 'BOOKED', userId: user._id });
    const before = Date.now();
    const res = await request(app)
      .patch(`/sessions/${session._id}/complete`)
      .send({ completedAt: '2000-01-01T00:00:00.000Z' });
    const after = Date.now();
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.userId).toBe(String(user._id));
    expect(res.body.data.teacherId).toBe(String(teacher._id));
    const completedAt = new Date(res.body.data.completedAt).getTime();
    expect(completedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(completedAt).toBeLessThanOrEqual(after + 1000);
  });

  it('rejects an AVAILABLE session (409)', async () => {
    const teacher = await makeTeacher();
    const session = await makeSession(teacher._id);
    const res = await request(app).patch(`/sessions/${session._id}/complete`);
    expect(res.status).toBe(409);
    expect((await Session.findById(session._id))?.status).toBe('AVAILABLE');
  });

  it('rejects a nonexistent session (404) and an invalid id (400)', async () => {
    expect((await request(app).patch(`/sessions/${randomId()}/complete`)).status).toBe(404);
    expect((await request(app).patch('/sessions/xyz/complete')).status).toBe(400);
  });

  it('rejects completing an already completed session (409)', async () => {
    const teacher = await makeTeacher();
    const user = await makeUser();
    const session = await makeSession(teacher._id, futureStart(), { status: 'BOOKED', userId: user._id });
    await request(app).patch(`/sessions/${session._id}/complete`).expect(200);
    const res = await request(app).patch(`/sessions/${session._id}/complete`);
    expect(res.status).toBe(409);
  });
});

describe('GET /users/:id/sessions', () => {
  it('separates upcoming and completed sessions, sorted by startTime, excluding other users', async () => {
    const teacher = await makeTeacher();
    const u1 = await makeUser('a@example.com');
    const u2 = await makeUser('b@example.com');
    const later = await makeSession(teacher._id, futureStart(72), { status: 'BOOKED', userId: u1._id });
    const sooner = await makeSession(teacher._id, futureStart(24), { status: 'BOOKED', userId: u1._id });
    const done = await makeSession(teacher._id, futureStart(-48), { status: 'COMPLETED', userId: u1._id, completedAt: new Date() });
    await makeSession(teacher._id, futureStart(-72), { status: 'BOOKED', userId: u1._id }); // past BOOKED: neither category
    await makeSession(teacher._id, futureStart(30), { status: 'BOOKED', userId: u2._id });
    await makeSession(teacher._id, futureStart(30)); // AVAILABLE, nobody's

    const res = await request(app).get(`/users/${u1._id}/sessions`);
    expect(res.status).toBe(200);
    const { upcomingSessions, completedSessions } = res.body.data;
    expect(upcomingSessions.map((s: { id: string }) => s.id)).toEqual([String(sooner._id), String(later._id)]);
    expect(completedSessions.map((s: { id: string }) => s.id)).toEqual([String(done._id)]);
    expect(upcomingSessions[0].teacher.fullName).toBe('Anita Verma');
  });

  it('returns empty arrays for a user with no sessions', async () => {
    const user = await makeUser();
    const res = await request(app).get(`/users/${user._id}/sessions`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ upcomingSessions: [], completedSessions: [] });
  });

  it('rejects an invalid user id (400) and a nonexistent user (404)', async () => {
    expect((await request(app).get('/users/xyz/sessions')).status).toBe(400);
    expect((await request(app).get(`/users/${randomId()}/sessions`)).status).toBe(404);
  });

  it('uses the aggregation pipeline with $facet', async () => {
    const user = await makeUser();
    const spy = vi.spyOn(Session, 'aggregate');
    await request(app).get(`/users/${user._id}/sessions`).expect(200);
    const stages = stageNames(spy.mock.calls[0][0]);
    expect(stages).toEqual(expect.arrayContaining(['$match', '$lookup', '$unwind', '$facet']));
    vi.restoreAllMocks();
  });
});

describe('End-to-end workflow', () => {
  it('runs create user -> create session -> available -> book -> my sessions -> complete -> my sessions -> rebook fails', async () => {
    const teacher = await makeTeacher();
    const user = (await request(app).post('/users').send({ fullName: 'E2E', email: 'e2e@example.com', phone: '1' }).expect(201)).body.data;
    const start = futureStart(48);
    const created = (
      await request(app)
        .post('/sessions')
        .send({ teacherId: String(teacher._id), startTime: start.toISOString(), endTime: new Date(start.getTime() + HOUR).toISOString() })
        .expect(201)
    ).body.data;

    const avail = await request(app).get(`/sessions/available?dateTimestamp=${start.getTime()}`).expect(200);
    expect(avail.body.data.map((s: { id: string }) => s.id)).toContain(created.id);

    const booked = (await request(app).post(`/sessions/${created.id}/book`).send({ userId: user.id }).expect(200)).body.data;
    expect(booked.status).toBe('BOOKED');
    expect(booked.userId).toBe(user.id);

    const mine1 = (await request(app).get(`/users/${user.id}/sessions`).expect(200)).body.data;
    expect(mine1.upcomingSessions.map((s: { id: string }) => s.id)).toEqual([created.id]);
    expect(mine1.completedSessions).toEqual([]);

    await request(app).patch(`/sessions/${created.id}/complete`).expect(200);

    const mine2 = (await request(app).get(`/users/${user.id}/sessions`).expect(200)).body.data;
    expect(mine2.upcomingSessions).toEqual([]);
    expect(mine2.completedSessions.map((s: { id: string }) => s.id)).toEqual([created.id]);

    await request(app).post(`/sessions/${created.id}/book`).send({ userId: user.id }).expect(409);
  });
});
