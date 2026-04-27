import type { AnyRecord, Identifier, MaybePromise } from './common';

export type QueryOptions = {
  filter?: AnyRecord | null;
  page?: number | string;
  limit?: number | string;
  sort?: string;
  order?: string;
  q?: string;
  embed?: string;
  expand?: string;
  includeRelations?: boolean;
  columns?: string[];
  [key: string]: any;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type FindAllResult<T = AnyRecord> = {
  success?: boolean;
  data: T[];
  pagination: PaginationMeta;
};

export type CollectionStore = Record<string, AnyRecord[]>;

export interface DatabaseAdapter {
  findAllAdvanced(collection: string, options?: QueryOptions): MaybePromise<FindAllResult>;
  findAll(collection: string): MaybePromise<AnyRecord[]>;
  findById(collection: string, id: Identifier): MaybePromise<AnyRecord | null | undefined>;
  findOne(collection: string, query: AnyRecord): MaybePromise<AnyRecord | null | undefined>;
  findMany(collection: string, query?: AnyRecord): MaybePromise<AnyRecord[]>;
  create(collection: string, data: AnyRecord): MaybePromise<AnyRecord>;
  update(collection: string, id: Identifier, data: AnyRecord): MaybePromise<AnyRecord | null>;
  updateMany(collection: string, query: AnyRecord, data: AnyRecord): MaybePromise<number>;
  delete(collection: string, id: Identifier): MaybePromise<boolean>;
  exists(collection: string, query: AnyRecord): MaybePromise<boolean>;
  distinct(collection: string, field: string, query?: AnyRecord): MaybePromise<any[]>;
  count(collection: string, query?: AnyRecord): MaybePromise<number>;
  insertMany(collection: string, records: AnyRecord[]): MaybePromise<AnyRecord[]>;
  deleteMany(collection: string, queryOrIds: any): MaybePromise<number>;
  getSlice(collection: string, start: number, end: number): MaybePromise<{ data: AnyRecord[]; total: number }>;
  getNextId(collection: string): MaybePromise<number>;
  saveData(): MaybePromise<boolean>;
}
