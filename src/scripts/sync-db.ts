import dns from 'dns';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();
// Ép Node dùng DNS ngoài (bypass DNS nội bộ server chặn SRV lookup của Atlas)
dns.setServers(['8.8.8.8', '1.1.1.1']);

const SOURCE_URI =
  process.env.SYNC_SOURCE_URL ||
  'mongodb+srv://phongbye01_db_user:rUdRjWAh681gk05p@tcns.ggkhtte.mongodb.net/tcns_dev?appName=TCNS';
const TARGET_URI =
  process.env.SYNC_TARGET_URL ||
  'mongodb+srv://tuannguyentien16_db_user:RLlS6siupCbBKWbR@cluster0.r59ei80.mongodb.net/tcns_dev?appName=TCNSDCD';

const BATCH_SIZE = 500;

async function main() {
  console.log('🔌 Kết nối MongoDB...');
  const srcClient = new MongoClient(SOURCE_URI);
  const tgtClient = new MongoClient(TARGET_URI);

  try {
    await srcClient.connect();
    await tgtClient.connect();
    console.log('✅ Đã kết nối thành công tới cả hai cơ sở dữ liệu.');

    const srcDb = srcClient.db();
    const tgtDb = tgtClient.db();

    console.log(`\n=========================================`);
    console.log(`👉 DB 1 (Source): ${srcDb.databaseName}`);
    console.log(`👉 DB 2 (Target): ${tgtDb.databaseName}`);
    console.log(`=========================================\n`);

    if (srcDb.databaseName === 'test' || tgtDb.databaseName === 'test') {
      console.warn('⚠️ CẢNH BÁO: Một trong hai DB đang trỏ vào bảng "test" mặc định.');
      console.warn('Đợi 5 giây để bạn kiểm tra, bấm Ctrl+C để hủy...\n');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    const srcCols = await srcDb.listCollections().toArray();
    const tgtCols = await tgtDb.listCollections().toArray();

    const allColNames = Array.from(new Set([...srcCols.map((c) => c.name), ...tgtCols.map((c) => c.name)])).filter(
      (name) => !name.startsWith('system.'),
    );

    console.log(`📦 Tìm thấy tổng cộng ${allColNames.length} collection(s) từ cả 2 DB.\n`);

    for (const colName of allColNames) {
      const srcCol = srcDb.collection(colName);
      const tgtCol = tgtDb.collection(colName);

      // Lấy toàn bộ _id từ 2 bên
      const srcIds = new Set(
        (await srcCol.find({}, { projection: { _id: 1 } }).toArray()).map((d) => d._id.toString()),
      );
      const tgtIds = new Set(
        (await tgtCol.find({}, { projection: { _id: 1 } }).toArray()).map((d) => d._id.toString()),
      );

      let addedToTgt = 0;
      let addedToSrc = 0;

      // 1. Tìm các doc có ở Source nhưng thiếu ở Target -> Thêm vào Target
      let batchTgt: any[] = [];
      const cursorSrc = srcCol.find({});
      for await (const doc of cursorSrc) {
        if (!tgtIds.has(doc._id.toString())) {
          batchTgt.push(doc);
          if (batchTgt.length >= BATCH_SIZE) {
            await tgtCol.insertMany(batchTgt, { ordered: false });
            addedToTgt += batchTgt.length;
            batchTgt = [];
          }
        }
      }
      if (batchTgt.length > 0) {
        await tgtCol.insertMany(batchTgt, { ordered: false });
        addedToTgt += batchTgt.length;
      }

      // 2. Tìm các doc có ở Target nhưng thiếu ở Source -> Thêm vào Source
      let batchSrc: any[] = [];
      const cursorTgt = tgtCol.find({});
      for await (const doc of cursorTgt) {
        if (!srcIds.has(doc._id.toString())) {
          batchSrc.push(doc);
          if (batchSrc.length >= BATCH_SIZE) {
            await srcCol.insertMany(batchSrc, { ordered: false });
            addedToSrc += batchSrc.length;
            batchSrc = [];
          }
        }
      }
      if (batchSrc.length > 0) {
        await srcCol.insertMany(batchSrc, { ordered: false });
        addedToSrc += batchSrc.length;
      }

      if (addedToTgt > 0 || addedToSrc > 0) {
        console.log(`🔄 [${colName}]`);
        if (addedToTgt > 0) console.log(`   ➡️ Đã bổ sung ${addedToTgt} document(s) sang DB 2`);
        if (addedToSrc > 0) console.log(`   ⬅️ Đã bổ sung ${addedToSrc} document(s) sang DB 1`);
      } else {
        // console.log(`🔄 [${colName}] - Đã đồng bộ (không thiếu gì)`);
      }

      // Tạo index (nếu collection mới được tạo)
      for (const col of [srcCol, tgtCol]) {
        try {
          const indexes = await col.indexes().catch(() => []);
          const nonIdIndexes = indexes.filter((idx) => idx.name !== '_id_');
          if (nonIdIndexes.length > 0) {
            const indexSpecs = nonIdIndexes.map((idx) => {
              const spec: any = { key: idx.key, name: idx.name, background: true };
              if (idx.unique != null) spec.unique = idx.unique;
              if (idx.sparse != null) spec.sparse = idx.sparse;
              if (idx.expireAfterSeconds != null) spec.expireAfterSeconds = idx.expireAfterSeconds;
              return spec;
            });
            // Áp dụng index của bên này cho bên kia (để đảm bảo 2 bên có index giống nhau)
            const otherCol = col === srcCol ? tgtCol : srcCol;
            await otherCol.createIndexes(indexSpecs as any).catch(() => {});
          }
        } catch (e) {
          // Bỏ qua lỗi index
        }
      }
    }

    console.log('\n🎉 HOÀN TẤT ĐỒNG BỘ 2 CHIỀU (Bổ sung dữ liệu thiếu)!');
  } catch (err) {
    console.error('\n❌ Lỗi trong quá trình đồng bộ:', err);
    process.exit(1);
  } finally {
    await srcClient.close();
    await tgtClient.close();
  }
}

main();
