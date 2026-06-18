import { TableColumnOptions } from 'typeorm';

export const ColumnIdIncrement: TableColumnOptions = {
  name: 'id',
  type: 'int',
  isPrimary: true,
  isGenerated: true,
  generationStrategy: 'increment',
};

export const ColumnCreatedAt: TableColumnOptions = {
  name: 'createdAt',
  type: 'timestamptz',
  default: 'now()',
};

export const ColumnUpdatedAt: TableColumnOptions = {
  name: 'updatedAt',
  type: 'timestamptz',
  default: 'now()',
};

export const ColumnDeleteAt: TableColumnOptions = {
  name: 'deletedAt',
  type: 'timestamptz',
  isNullable: true,
};

export const ColumnName: TableColumnOptions = {
  name: 'name',
  type: 'varchar',
  length: '255',
};

export const ColumnIdUUID: TableColumnOptions = {
  name: 'id',
  type: 'uuid',
  isPrimary: true,
  generationStrategy: 'uuid',
  default: 'uuid_generate_v4()',
};

export const ColumnIsActive: TableColumnOptions = {
  name: 'isActive',
  type: 'boolean',
  default: true,
};

export const ColumnDescription: TableColumnOptions = {
  name: 'description',
  type: 'text',
  isNullable: true,
};

export const ColumnContent: TableColumnOptions = {
  name: 'content',
  type: 'text',
  isNullable: true,
};

export const ColumnAbleTable: TableColumnOptions = {
  name: 'ableTable',
  type: 'varchar',
  length: '255',
};

export const ColumnAbleId: TableColumnOptions = {
  name: 'ableId',
  type: 'int',
};

export const ColumnUrlPath: TableColumnOptions = {
  name: 'urlPath',
  type: 'varchar',
  length: '255',
  isNullable: true,
};
