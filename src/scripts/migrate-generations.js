import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'src/database/db.json');

function migrate() {
    try {
        console.log('Reading database file...');
        const rawData = fs.readFileSync(DB_FILE, 'utf8');
        const db = JSON.parse(rawData);

        // 1. Initialize generations if missing or empty
        if (!db.generations || db.generations.length === 0) {
            console.log('Initializing generations collection...');
            db.generations = [
                {
                    id: 1,
                    name: 'Thế hệ 1',
                    description: 'Thế hệ khởi tạo hệ thống',
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ];
        }

        const defaultGenId = db.generations[0].id;

        // 2. Map existing users to the first generation
        if (db.users && Array.isArray(db.users)) {
            console.log(`Migrating ${db.users.length} users...`);
            db.users = db.users.map(user => {
                if (!user.generationId) {
                    return { ...user, generationId: defaultGenId };
                }
                return user;
            });
        }

        // 3. Save back to file
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
}

migrate();
