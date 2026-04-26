import { Schema, model } from 'mongoose';

const roleSchema = new Schema(
  {
    name: { type: String, required: true }, // e.g., 'Ban Nhân sự'
    slug: { type: String, required: true, unique: true }, // e.g., 'hr-board'
    permissions: [{ type: String }], // Array of permission keys
    description: { type: String },
    isSystem: { type: Boolean, default: false }, // Cannot delete system roles
  },
  {
    timestamps: true,
    collection: 'roles',
  },
);

export const Role = model('Role', roleSchema);
