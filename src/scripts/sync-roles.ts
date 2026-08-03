import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { initDatabase } from '../database/mongo-database.adapter';
import { getSuggestedRoles } from '../modules/users/utils/user-mapping.utils';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function syncRoles() {
  try {
    console.log('Connecting to MongoDB...');
    await initDatabase();
    const mongoose = require('mongoose');
    const UserModel = mongoose.models['users'];

    if (!UserModel) {
      console.error('UserModel not found');
      process.exit(1);
    }

    const users = await UserModel.find({});
    console.log(`Found ${users.length} users. Syncing roles...`);

    let updatedCount = 0;
    for (const user of users) {
      const position = user.position;
      const department = user.department;
      if (position) {
        const suggestedRoles = getSuggestedRoles(position, department);
        if (suggestedRoles && suggestedRoles.length > 0) {
          await UserModel.updateOne({ _id: user._id }, { $set: { roleIds: suggestedRoles } });
          updatedCount++;
        }
      }
    }

    // Critical Admin Wildcard Sync (like in seed-rbac)
    await UserModel.updateMany({ $or: [{ role: 'admin' }, { roleIds: 1 }] }, { $addToSet: { permissions: '*' } });

    console.log(`Synced roles for ${updatedCount} users.`);
    console.log('Admin permissions synchronized.');
    console.log('Done!');
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    process.exit();
  }
}

syncRoles();
