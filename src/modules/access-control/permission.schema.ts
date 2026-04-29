import { Schema, model } from 'mongoose';

const permissionSchema = new Schema(
  {
    key: { type: String, required: true, unique: true }, // e.g., 'users:create'
    name: { type: String, required: true }, // e.g., 'Thêm mới thành viên'
    module: { type: String, required: true }, // e.g., 'users'
    description: { type: String },
  },
  {
    timestamps: true,
    collection: 'permissions',
  },
);

export const Permission = model('Permission', permissionSchema);
