/**
 * Script sao chép toàn bộ MongoDB database từ SOURCE sang TARGET.
 *
 * SOURCE: mongodb+srv://phongbye01_db_user:...@tcns.ggkhtte.mongodb.net/tcns_dev
 * TARGET: mongodb+srv://tuannguyentien16_db_user:...@cluster0.r59ei80.mongodb.net/tcns_dev
 *
 * Cách chạy:
 *   npx tsx src/scripts/copy-db.ts
 */

import dns from 'dns';
import { MongoClient } from 'mongodb';

// Ép Node dùng DNS ngoài (bypass DNS nội bộ server chặn SRV lookup của Atlas)
dns.setServers(['8.8.8.8', '1.1.1.1']);

// ─── CẤU HÌNH ──────────────────────────────────────────────────────────────
const SOURCE_URI = 'mongodb+srv://phongbye01_db_user:rUdRjWAh681gk05p@tcns.ggkhtte.mongodb.net/tcns_dev?appName=TCNS';
const SOURCE_DB = 'tcns_dev';

const TARGET_URI =
  'mongodb+srv://tuannguyentien16_db_user:RLlS6siupCbBKWbR@cluster0.r59ei80.mongodb.net/?appName=TCNSDCD';
const TARGET_DB = 'tcns_dev'; // Tên DB bên target (đổi nếu cần)

// Số document ghi vào target mỗi lần (tăng nếu RAM đủ, giảm nếu timeout)
const BATCH_SIZE = 200;

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔌 Kết nối MongoDB...');

  const srcClient = new MongoClient(SOURCE_URI);
  const tgtClient = new MongoClient(TARGET_URI);

  try {
    await srcClient.connect();
    await tgtClient.connect();
    console.log('✅ Đã kết nối cả hai cluster.');

    const srcDb = srcClient.db(SOURCE_DB);
    const tgtDb = tgtClient.db(TARGET_DB);

    // Lấy danh sách collection từ source
    const collections = await srcDb.listCollections().toArray();
    console.log(`\n📦 Tìm thấy ${collections.length} collection(s): ${collections.map((c) => c.name).join(', ')}\n`);

    for (const colMeta of collections) {
      const colName = colMeta.name;
      const srcCol = srcDb.collection(colName);
      const tgtCol = tgtDb.collection(colName);

      const total = await srcCol.countDocuments();
      console.log(`\n🔄 [${colName}] Tổng ${total} document(s)`);

      if (total === 0) {
        console.log(`   ⏭️  Bỏ qua (rỗng)`);
        continue;
      }

      // Xóa collection cũ bên target trước khi copy (đảm bảo idempotent)
      await tgtCol.drop().catch(() => {
        /* collection chưa tồn tại - bỏ qua */
      });

      let inserted = 0;
      const cursor = srcCol.find({});
      const batch: any[] = [];

      for await (const doc of cursor) {
        batch.push(doc);

        if (batch.length >= BATCH_SIZE) {
          await tgtCol.insertMany(batch, { ordered: false });
          inserted += batch.length;
          process.stdout.write(`   📤 ${inserted}/${total}\r`);
          batch.length = 0;
        }
      }

      // Flush phần còn lại
      if (batch.length > 0) {
        await tgtCol.insertMany(batch, { ordered: false });
        inserted += batch.length;
      }

      console.log(`   ✅ Đã copy ${inserted}/${total} document(s)`);

      // Copy indexes (bỏ qua _id_ vì MongoDB tự tạo)
      const indexes = await srcCol.indexes();
      const nonIdIndexes = indexes.filter((idx) => idx.name !== '_id_');
      if (nonIdIndexes.length > 0) {
        const indexSpecs = nonIdIndexes.map((idx) => {
          const spec: any = {
            key: idx.key,
            name: idx.name,
            background: true,
          };
          if (idx.unique != null) spec.unique = idx.unique;
          if (idx.sparse != null) spec.sparse = idx.sparse;
          if (idx.expireAfterSeconds != null) spec.expireAfterSeconds = idx.expireAfterSeconds;
          return spec;
        });
        await tgtCol.createIndexes(indexSpecs as any).catch((err) => {
          console.warn(`   ⚠️  Lỗi tạo index cho [${colName}]: ${err.message}`);
        });
        console.log(`   📇 Đã tạo ${nonIdIndexes.length} index(es)`);
      }
    }

    console.log('\n🎉 Hoàn thành sao chép toàn bộ database!');
    console.log(`   Source: ${SOURCE_DB} @ tcns.ggkhtte.mongodb.net`);
    console.log(`   Target: ${TARGET_DB} @ cluster0.r59ei80.mongodb.net`);
  } catch (err) {
    console.error('\n❌ Lỗi:', err);
    process.exit(1);
  } finally {
    await srcClient.close();
    await tgtClient.close();
  }
}

main();
