import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env } from '../src/config/env';
import { Teacher } from '../src/models/teacher.model';

const SEED_EMAIL = 'anita.verma@example.com';

async function seed(): Promise<void> {
  await connectDatabase(env.mongoUri);

  // Idempotent: re-running reuses the same teacher.
  const teacher = await Teacher.findOneAndUpdate(
    { email: SEED_EMAIL },
    {
      $setOnInsert: {
        fullName: 'Anita Verma',
        email: SEED_EMAIL,
        specialization: 'Mathematics',
        experience: 8,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  console.log('Teacher ready. Use this value as teacherId:');
  console.log(String(teacher?._id));

  await disconnectDatabase();
}

seed().catch(async (err) => {
  console.error(
    'Seeding failed:',
    err instanceof Error ? err.message : err,
  );

  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
