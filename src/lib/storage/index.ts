/**
 * Storage system exports - Abstract storage adapter interface and utilities
 */

// Base storage adapter and utilities
export { BaseStorageAdapter, StorageUtils } from './storage-adapter';

// Concrete storage adapters
export { FileStorageAdapter, FileStorageUtils } from './adapters/file-storage-adapter';

// Storage manager for coordinating adapters
export { StorageManager } from './storage-manager';
export type { StorageManagerEvents, StorageEventCallback } from './storage-manager';

// Configuration utilities and builders
export {
  StorageConfigBuilder,
  StorageConfigPresets,
  StorageConfigFactory,
  StorageConfigValidator,
  createStorageConfig,
  DEFAULT_STORAGE_CONFIG,
} from './storage-config';

// Re-export types from the types directory for convenience
export type {
  StorageAdapter,
  SaveOptions,
  SaveResult,
  LoadOptions,
  LoadResult,
  DeleteResult,
  ListOptions,
  ListResult,
  FileStorageOptions,
  CloudStorageOptions,
  DatabaseStorageOptions,
  StorageConfig,
  StorageOperationStatus,
} from '@/types/storage';

export type {
  Diagram,
  DiagramInfo,
  DiagramMetadata,
  DiagramState,
  DiagramSnapshot,
  DiagramOperation,
  DiagramFile,
  FileFormatVersion,
} from '@/types/diagram';

export type {
  ID,
  Point,
  Rectangle,
  Size,
  Color,
  Timestamp,
  AppError,
  LoadingState,
  Tool,
  ConnectionPoint,
} from '@/types/common';
