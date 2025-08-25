/**
 * Storage adapters exports - Concrete implementations of storage adapters
 */

export { FileStorageAdapter, FileStorageUtils } from './file-storage-adapter';

// Example usage:
// import { FileStorageAdapter, StorageConfigBuilder } from '@/lib/storage';
//
// const fileAdapter = new FileStorageAdapter({
//   maxFileSize: 50 * 1024 * 1024, // 50MB
//   allowedExtensions: ['json'],
//   useCompression: false,
// });
//
// const config = new StorageConfigBuilder()
//   .setDefaultAdapter('file')
//   .addAdapter('file', fileAdapter)
//   .enableAutoSave(30000)
//   .build();
