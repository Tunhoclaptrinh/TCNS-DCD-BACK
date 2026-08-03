import * as XLSX from 'xlsx';
import * as path from 'path';
import dns from 'dns';
import dotenv from 'dotenv';
import { initDatabase } from '@database/mongo-database.adapter';
import db from '@database/mongo-database.adapter';
import userService from '@modules/users/services/user.service';
import { logger } from '@utils/logger';

// Set DNS for MongoDB Atlas connection
dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

const EXCEL_FILE = path.join(process.cwd(), '_TV 2026 ĐCĐ.xlsx');
const GENERATION_NAME = 'Khóa 2023 (D23)';
const DEFAULT_PASSWORD = 'Dcdptit@2026'; // Needs lowercase to pass validation

const POSITION_MAP: Record<string, string> = {
  'Trưởng Ban': 'tb',
  'Phó Ban': 'pb',
  'Thành viên': 'tv',
  'Cộng tác viên': 'ctv',
  'Chủ tịch': 'dt',
  'Chủ nhiệm': 'dt',
  'Đội trưởng': 'dt',
};

function mapPosition(excelPos: string): string {
  if (!excelPos) return 'tv';

  for (const [key, val] of Object.entries(POSITION_MAP)) {
    if (excelPos.includes(key)) return val;
  }

  return 'tv';
}

async function run() {
  try {
    await initDatabase();
    logger.info('Database initialized');

    // 1. Setup Generation Cache
    const generationCache: Record<string, number> = {};
    async function getGenId(name: string) {
      if (generationCache[name]) return generationCache[name];
      let gen = await db.findOne('generations', { name });
      if (!gen) {
        logger.info(`Creating generation: ${name}`);
        gen = await db.create('generations', { name, isActive: true, isCurrent: false });
      }
      generationCache[name] = gen.id;
      return gen.id;
    }

    // 2. Read Excel
    const workbook = XLSX.readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    logger.info(`Found ${rawData.length} rows in Excel`);

    let successCount = 0;
    let deleteCount = 0;
    let errorCount = 0;
    const activeGenerationIds = new Set<number>();

    for (const row of rawData as any[]) {
      try {
        const studentId = String(row['MÃ SV'] || '').trim();
        const firstName = String(row['TÊN'] || '').trim();
        const lastName = String(row['HỌ'] || '').trim();

        if (!studentId || !firstName) {
          logger.warn(`Skipping invalid row: ${JSON.stringify(row)}`);
          continue;
        }

        // Determine Generation Name from Student ID (e.g. B24 -> Khóa 2024 (D24))
        const yearPart = studentId.match(/B(\d{2})/i)?.[1];
        if (!yearPart) {
          logger.warn(`Could not determine year from studentId: ${studentId}`);
          continue;
        }
        const genName = `Khóa 20${yearPart} (D${yearPart})`;
        const currentGenId = await getGenId(genName);
        activeGenerationIds.add(currentGenId);

        const email = `${studentId.toLowerCase()}@student.ptit.edu.vn`;

        // Check and Delete existing user
        const existing = await db.findOne('users', {
          $or: [{ studentId }, { email }],
        });

        if (existing) {
          logger.info(`Deleting existing user: ${studentId} / ${email}`);
          // Using permanentDeleteUser with dummy admin info (ID 1)
          await userService.permanentDeleteUser(existing.id, 1, ['*']);
          deleteCount++;
        }

        // Map data - All in Excel are "active/official"
        const userData = {
          studentId,
          firstName,
          lastName,
          name: `${lastName} ${firstName}`.trim(),
          classId: String(row['MÃ LỚP'] || '').trim(),
          phone: String(row['SĐT'] || '').trim(),
          hometown: String(row['QUÊ QUÁN'] || '').trim(),
          position: mapPosition(row['CHỨC VỤ']),
          department: String(row['BAN'] || '').trim(),
          email,
          password: DEFAULT_PASSWORD,
          generationId: currentGenId,
          status: 'active',
          isActive: true,
          role: 'customer',
        };

        // Handle date of birth
        if (row['NGÀY SINH']) {
          let dob: Date;
          if (typeof row['NGÀY SINH'] === 'number') {
            dob = new Date((row['NGÀY SINH'] - 25569) * 86400 * 1000);
          } else {
            dob = new Date(row['NGÀY SINH']);
          }
          if (!isNaN(dob.getTime())) {
            (userData as any).dob = dob.toISOString();
          }
        }

        // Create user using UserService to handle hashing and other logic
        const result = await userService.create(userData, 1);
        if (result.success) {
          successCount++;
        } else {
          logger.error(
            `Failed to create user ${studentId}: ${result.message} ${result.errors ? JSON.stringify(result.errors) : ''}`,
          );
          errorCount++;
        }
      } catch (err) {
        logger.error(`Error processing row ${row['MÃ SV']}: ${err.message}`);
        errorCount++;
      }
    }

    logger.success(`Import completed: ${successCount} success, ${deleteCount} deleted, ${errorCount} errors`);
    process.exit(0);
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

run();
