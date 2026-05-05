import mongoose, { Schema, Document } from 'mongoose';

export interface IDutySnapshot extends Document {
  name: string;
  note?: string;
  startDate: Date;
  endDate: Date;
  config: any; // The simulation parameters used
  data: any[]; // The calculated details per user
  summary: any; // Insights summary
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const DutySnapshotSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    note: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    config: { type: Schema.Types.Mixed, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    summary: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export default mongoose.model<IDutySnapshot>('DutySnapshot', DutySnapshotSchema);
