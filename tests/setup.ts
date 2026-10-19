import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Session } from '../src/models/session.model';
import { Teacher } from '../src/models/teacher.model';
import { User } from '../src/models/user.model';

let memoryServer: MongoMemoryServer | undefined;

/**
 * Connects to MONGODB_TEST_URI if set (any real MongoDB, e.g. a local mongod),
 * otherwise spins up an in-memory MongoDB via mongodb-memory-server.
 */
export async function setupDb(): Promise<void> {
  let uri = process.env.MONGODB_TEST_URI;
  if (!uri) {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('teacher_session_booking_test');
  }
  await mongoose.connect(uri);
  await Promise.all([User.init(), Session.init(), Teacher.init()]);
}

export async function clearDb(): Promise<void> {
  await Promise.all([User.deleteMany({}), Teacher.deleteMany({}), Session.deleteMany({})]);
}

export async function teardownDb(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
