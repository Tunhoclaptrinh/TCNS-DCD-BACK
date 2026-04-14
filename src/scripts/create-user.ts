import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_FILE = path.resolve(process.cwd(), 'src/database/db.json');

try {
  let data = { users: [] };
  if (fs.existsSync(DB_FILE)) {
    data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }

  const email = 'tuannt16@dcd.com';
  const password = 'tuannt16';
  const hashedPassword = bcrypt.hashSync(password, 10);

  // Check if user already exists
  const exists = data.users.find((u: any) => u.email === email);
  if (exists) {
    console.log(`User ${email} already exists in db.json!`);
    process.exit(0);
  }

  const nextId = data.users.length > 0 ? Math.max(...data.users.map((u: any) => u.id)) + 1 : 1;

  const newUser = {
    id: nextId,
    email,
    password: hashedPassword,
    name: 'Tuan NT16',
    phone: '0123456789',
    address: 'Hanoi',
    avatar: 'https://ui-avatars.com/api/?name=Tuan+NT&background=random',
    role: 'admin',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: null,
  };

  data.users.push(newUser);

  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  console.log(`Successfully created user: ${email} | ${password} in db.json!`);
} catch (error) {
  console.error('Error writing to db.json:', error);
}
