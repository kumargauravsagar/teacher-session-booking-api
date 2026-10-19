import { IUser, User } from '../models/user.model';
import { CreateUserInput } from '../validators/user.validator';

export async function createUser(input: CreateUserInput): Promise<IUser> {
  // Duplicate emails surface as a Mongo E11000 error, translated to 409 by the error middleware.
  return User.create(input);
}
