import { Document, Model, Schema, model } from 'mongoose';

export interface ITeacher extends Document {
  fullName: string;
  email: string;
  specialization: string;
  experience: number;
  createdAt: Date;
  updatedAt: Date;
}

const teacherSchema = new Schema<ITeacher>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    specialization: { type: String, required: true, trim: true },
    experience: { type: Number, required: true, min: [0, 'Experience cannot be negative'] },
  },
  { timestamps: true, versionKey: false },
);

export const Teacher: Model<ITeacher> = model<ITeacher>('Teacher', teacherSchema);
