/**
 * Script reset collection - xóa toàn bộ documents trừ các ID ngoại lệ.
 *
 * Cách dùng:
 *   1. Điền COLLECTION_NAME
 *   2. Điền EXCEPT_IDS (các _id muốn giữ lại)
 *   3. npm run reset:col
 */

import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { ObjectId, MongoClient } from 'mongodb';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

// ─── CẤU HÌNH — chỉ cần sửa 2 chỗ này ─────────────────────────────────────

/** Tên collection cần reset */
const COLLECTION_NAME = '_counters';

/**
 * Danh sách _id KHÔNG bị xóa.
 * Hỗ trợ cả ObjectId string (24 ký tự hex) và numeric id.
 * Để trống [] nếu muốn xóa hết.
 */
const EXCEPT_IDS: (string | number)[] = [
  // '6621f3a2b4e2c1d0f800001a',  // ví dụ ObjectId
  // 1,                            // ví dụ numeric id
];

// ────────────────────────────────────────────────────────────────────────────

const DB_URL = process.env.DATABASE_URL!;
const DB_NAME =
  new URL(DB_URL.replace('mongodb+srv://', 'https://')).pathname.replace('/', '').split('?')[0] || 'tcns_dev';

function parseId(id: string | number) {
  if (typeof id === 'number') return id;
  // Nếu là 24-char hex → ObjectId, ngược lại giữ nguyên string
  return /^[a-f\d]{24}$/i.test(id) ? new ObjectId(id) : id;
}

async function main() {
  if (!DB_URL) {
    console.error('❌ Chưa có DATABASE_URL trong .env');
    process.exit(1);
  }

  console.log(`\n🗄️  Database : ${DB_NAME}`);
  console.log(`📦 Collection: ${COLLECTION_NAME}`);
  console.log(`🔒 Giữ lại   : ${EXCEPT_IDS.length > 0 ? EXCEPT_IDS.join(', ') : '(không có — xóa hết)'}`);
  console.log('');

  const client = new MongoClient(DB_URL);
  await client.connect();

  const col = client.db(DB_NAME).collection(COLLECTION_NAME);

  // Đếm trước
  const totalBefore = await col.countDocuments();
  console.log(`📊 Tổng trước khi reset: ${totalBefore} document(s)`);

  // Build filter
  const parsedIds = EXCEPT_IDS.map(parseId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = parsedIds.length > 0 ? { $nor: [{ _id: { $in: parsedIds } }, { id: { $in: EXCEPT_IDS } }] } : {};

  // Dry-run: đếm bao nhiêu sẽ bị xóa
  const willDelete = await col.countDocuments(filter);
  console.log(`🗑️  Sẽ xóa   : ${willDelete} document(s)`);
  console.log(`✅ Giữ lại   : ${totalBefore - willDelete} document(s)`);

  if (willDelete === 0) {
    console.log('\n⚠️  Không có document nào cần xóa. Kết thúc.');
    await client.close();
    return;
  }

  // Xác nhận
  console.log('\n⏳ Bắt đầu xóa sau 3 giây... (Ctrl+C để hủy)');
  await new Promise((r) => setTimeout(r, 3000));

  const result = await col.deleteMany(filter);
  console.log(`\n🎉 Đã xóa ${result.deletedCount} document(s) khỏi [${COLLECTION_NAME}]`);

  const totalAfter = await col.countDocuments();
  console.log(`📊 Tổng còn lại: ${totalAfter} document(s)`);

  await client.close();
}

main().catch((err) => {
  console.error('\n❌ Lỗi:', err);
  process.exit(1);
});
