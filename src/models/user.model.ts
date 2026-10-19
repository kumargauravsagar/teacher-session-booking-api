import { Document, Model, Schema, model } from 'mongoose';

export interface IUser extends Document {
  fullName: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    // Normalised (trim + lowercase) and uniquely indexed at the MongoDB level.
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, 'Invalid email format'],
    },
    phone: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

export const User: Model<IUser> = model<IUser>('User', userSchema);
