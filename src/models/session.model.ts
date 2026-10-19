import { Document, Model, Schema, Types, model } from 'mongoose';

export const SESSION_STATUSES = ['AVAILABLE', 'BOOKED', 'COMPLETED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface ISession extends Document {
  teacherId: Types.ObjectId;
  userId: Types.ObjectId | null;
  startTime: Date;
  endTime: Date;
  status: SessionStatus;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: SESSION_STATUSES, default: 'AVAILABLE', required: true },
    completedAt: { type: Date, default: null },
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

// Supports the "available sessions for a day" query.
sessionSchema.index({ status: 1, startTime: 1 });

// Guard time ordering and the status / userId / completedAt combinations on save.
sessionSchema.pre('validate', function (this: ISession) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    throw new Error('endTime must be strictly later than startTime');
  }
  if (this.status === 'AVAILABLE' && (this.userId || this.completedAt)) {
    throw new Error('AVAILABLE sessions must not have a user or completedAt');
  }
  if (this.status === 'BOOKED' && (!this.userId || this.completedAt)) {
    throw new Error('BOOKED sessions must have a user and no completedAt');
  }
  if (this.status === 'COMPLETED' && (!this.userId || !this.completedAt)) {
    throw new Error('COMPLETED sessions must have a user and completedAt');
  }
});

export const Session: Model<ISession> = model<ISession>('Session', sessionSchema);
