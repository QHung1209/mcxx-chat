import { DeepPartial, ObjectLiteral, Repository, SaveOptions } from 'typeorm';

export class BaseRepository<
  Entity extends ObjectLiteral,
> extends Repository<Entity> {
  override save<T extends DeepPartial<Entity>>(
    entities: T[],
    options: SaveOptions & { reload: false },
  ): Promise<T[]>;
  override save<T extends DeepPartial<Entity>>(
    entities: T[],
    options?: SaveOptions,
  ): Promise<(T & Entity)[]>;
  override save<T extends DeepPartial<Entity>>(
    entity: T,
    options: SaveOptions & { reload: false },
  ): Promise<T>;
  override save<T extends DeepPartial<Entity>>(
    entity: T,
    options?: SaveOptions,
  ): Promise<T & Entity>;
  override save<T extends DeepPartial<Entity>>(
    entityOrEntities: T | T[],
    options?: SaveOptions,
  ): Promise<T | T[]> {
    const ctor = this.target;
    const toInstance = (value: T): T =>
      value &&
      typeof value === 'object' &&
      typeof ctor === 'function' &&
      !(value instanceof ctor)
        ? (this.create(value) as unknown as T)
        : value;

    const prepared = Array.isArray(entityOrEntities)
      ? entityOrEntities.map(toInstance)
      : toInstance(entityOrEntities);

    return super.save(prepared as any, options);
  }
}
