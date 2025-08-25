/**
 * Storage adapter interface and related types for diagram persistence
 */

import type { AppError, LoadingState } from './common';
import type { Diagram, DiagramInfo } from './diagram';

/** Abstract storage adapter interface */
export interface StorageAdapter {
  /** Adapter name for identification */
  readonly name: string;
  /** Whether the adapter supports read operations */
  readonly canRead: boolean;
  /** Whether the adapter supports write operations */
  readonly canWrite: boolean;
  /** Whether the adapter supports listing files */
  readonly canList: boolean;

  /**
   * Save a diagram to storage
   * @param diagram The diagram to save
   * @param options Additional save options
   * @returns Promise resolving to success status and metadata
   */
  save(diagram: Diagram, options?: SaveOptions): Promise<SaveResult>;

  /**
   * Load a diagram from storage
   * @param id The diagram ID or file path
   * @param options Additional load options
   * @returns Promise resolving to the loaded diagram
   */
  load(id: string, options?: LoadOptions): Promise<LoadResult>;

  /**
   * Delete a diagram from storage
   * @param id The diagram ID or file path
   * @returns Promise resolving to success status
   */
  delete(id: string): Promise<DeleteResult>;

  /**
   * List available diagrams
   * @param options Filtering and pagination options
   * @returns Promise resolving to list of diagram info
   */
  list(options?: ListOptions): Promise<ListResult>;

  /**
   * Check if a diagram exists
   * @param id The diagram ID or file path
   * @returns Promise resolving to existence status
   */
  exists(id: string): Promise<boolean>;

  /**
   * Get metadata for a diagram without loading the full content
   * @param id The diagram ID or file path
   * @returns Promise resolving to diagram metadata
   */
  getMetadata(id: string): Promise<DiagramInfo>;
}

/** Options for save operations */
export interface SaveOptions {
  /** Whether to create a backup before saving */
  backup?: boolean;
  /** Custom file name (if supported by adapter) */
  filename?: string;
  /** Whether to compress the file */
  compress?: boolean;
  /** Additional metadata to store */
  metadata?: Record<string, unknown>;
}

/** Result of save operations */
export interface SaveResult {
  success: boolean;
  id: string;
  path?: string;
  size?: number;
  error?: AppError;
  metadata?: Record<string, unknown>;
}

/** Options for load operations */
export interface LoadOptions {
  /** Whether to include full element data or just metadata */
  includeElements?: boolean;
  /** Version to load (if adapter supports versioning) */
  version?: string;
  /** Whether to validate the loaded data */
  validate?: boolean;
}

/** Result of load operations */
export interface LoadResult {
  success: boolean;
  diagram?: Diagram;
  metadata?: DiagramInfo;
  error?: AppError;
}

/** Result of delete operations */
export interface DeleteResult {
  success: boolean;
  error?: AppError;
}

/** Options for list operations */
export interface ListOptions {
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort field */
  sortBy?: 'name' | 'created' | 'modified' | 'size';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Filter by name pattern */
  nameFilter?: string;
  /** Filter by tags */
  tags?: string[];
  /** Date range filter */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

/** Result of list operations */
export interface ListResult {
  success: boolean;
  diagrams: DiagramInfo[];
  total: number;
  hasMore: boolean;
  error?: AppError;
}

/** File storage adapter specific options */
export interface FileStorageOptions {
  /** Default directory for saving files */
  defaultDirectory?: string;
  /** Allowed file extensions */
  allowedExtensions?: string[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Whether to use compression */
  useCompression?: boolean;
}

/** Cloud storage adapter specific options */
export interface CloudStorageOptions {
  /** API endpoint URL */
  apiUrl?: string;
  /** Authentication credentials */
  credentials?: {
    apiKey?: string;
    token?: string;
    refreshToken?: string;
  };
  /** Sync settings */
  sync?: {
    enabled: boolean;
    interval: number;
    conflictResolution: 'local' | 'remote' | 'manual';
  };
}

/** Database storage adapter specific options */
export interface DatabaseStorageOptions {
  /** Connection string or configuration */
  connection: string | Record<string, unknown>;
  /** Table/collection name */
  tableName?: string;
  /** Query timeout in milliseconds */
  timeout?: number;
  /** Connection pooling settings */
  pool?: {
    min: number;
    max: number;
  };
}

/** Storage configuration for the application */
export interface StorageConfig {
  /** Default adapter to use */
  defaultAdapter: string;
  /** Available adapters */
  adapters: Record<string, StorageAdapter>;
  /** Global storage options */
  options: {
    autoSave: boolean;
    autoSaveInterval: number;
    maxBackups: number;
    validateOnLoad: boolean;
  };
}

/** Storage operation status */
export interface StorageOperationStatus {
  operation: 'save' | 'load' | 'delete' | 'list';
  status: LoadingState;
  progress?: number;
  message?: string;
  error?: AppError;
}