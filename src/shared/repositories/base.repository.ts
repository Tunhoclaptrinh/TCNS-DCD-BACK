import db from '@database';
import type { AnyRecord, Identifier } from '@app-types/common';
import type { DatabaseAdapter, FindAllResult, QueryOptions } from '@app-types/database';

class BaseRepository<TRecord extends AnyRecord = AnyRecord> {
  protected readonly collection: string;
  protected readonly database: DatabaseAdapter;

  constructor(collection: string, database: DatabaseAdapter = db) {
    this.collection = collection;
    this.database = database;
  }

  get collectionName() {
    return this.collection;
  }

  async findAllAdvanced(options: QueryOptions = {}): Promise<FindAllResult<TRecord>> {
    return (await this.database.findAllAdvanced(this.collection, options)) as FindAllResult<TRecord>;
  }

  async findAll(): Promise<TRecord[]> {
    return (await this.database.findAll(this.collection)) as TRecord[];
  }

  async findById(id: Identifier): Promise<TRecord | null | undefined> {
    return (await this.database.findById(this.collection, id)) as TRecord | null | undefined;
  }

  async findOne(query: AnyRecord): Promise<TRecord | null | undefined> {
    return (await this.database.findOne(this.collection, query)) as TRecord | null | undefined;
  }

  async findMany(query: AnyRecord = {}): Promise<TRecord[]> {
    return (await this.database.findMany(this.collection, query)) as TRecord[];
  }

  async create(data: AnyRecord): Promise<TRecord> {
    return (await this.database.create(this.collection, data)) as TRecord;
  }

  async update(id: Identifier, data: AnyRecord): Promise<TRecord | null> {
    return (await this.database.update(this.collection, id, data)) as TRecord | null;
  }

  async delete(id: Identifier): Promise<boolean> {
    return await this.database.delete(this.collection, id);
  }

  async deleteMany(query: AnyRecord): Promise<number> {
    return await this.database.deleteMany(this.collection, query);
  }

  async insertMany(records: AnyRecord[]): Promise<TRecord[]> {
    return (await this.database.insertMany(this.collection, records)) as TRecord[];
  }

  async count(query: AnyRecord = {}): Promise<number> {
    return await this.database.count(this.collection, query);
  }

  async exists(query: AnyRecord): Promise<boolean> {
    return await this.database.exists(this.collection, query);
  }

  async distinct(field: string, query: AnyRecord = {}) {
    return await this.database.distinct(this.collection, field, query);
  }

  async getNextId(): Promise<number> {
    return await this.database.getNextId(this.collection);
  }
}

export default BaseRepository;
