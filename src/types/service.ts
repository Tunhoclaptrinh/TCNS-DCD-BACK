import type { AnyRecord, Identifier } from './common';
import type { QueryOptions } from './database';
import type { SchemaDefinition } from './schema';

export type ServiceResult<T = any> = {
  success: boolean;
  message?: string;
  statusCode?: number;
  errors?: AnyRecord;
  data?: T;
  pagination?: AnyRecord;
  [key: string]: any;
};

export type CrudService = AnyRecord & {
  getSchema(): SchemaDefinition | null;
  findAll(options?: QueryOptions): Promise<ServiceResult<any[]>>;
  findById(id: Identifier): Promise<ServiceResult>;
  findOne(query: AnyRecord): Promise<ServiceResult>;
  findMany(query: AnyRecord): Promise<ServiceResult<any[]>>;
  create(data: AnyRecord, performer?: AnyRecord): Promise<ServiceResult>;
  update(id: Identifier, data: AnyRecord, performer?: AnyRecord): Promise<ServiceResult>;
  delete(id: Identifier, performer?: AnyRecord): Promise<ServiceResult>;
  search(query: string, options?: QueryOptions): Promise<ServiceResult<any[]>>;
  count(query?: AnyRecord): Promise<number>;
  bulkCreate(items?: AnyRecord[], performer?: AnyRecord): Promise<AnyRecord>;
  bulkUpdate(updates?: AnyRecord[], performer?: AnyRecord): Promise<AnyRecord>;
  bulkDelete(ids?: Identifier[], performer?: AnyRecord): Promise<AnyRecord>;
  validateBySchema(data: AnyRecord, options?: AnyRecord): Promise<{ success: boolean; errors?: AnyRecord }>;
  importData?(records: AnyRecord[]): Promise<ServiceResult>;
  prepareExportData?(options?: QueryOptions): Promise<AnyRecord[]>;
};
