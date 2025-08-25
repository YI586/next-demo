/**
 * Abstract storage adapter base class and utilities for diagram persistence
 */

import type {
  StorageAdapter,
  SaveOptions,
  SaveResult,
  LoadOptions,
  LoadResult,
  DeleteResult,
  ListOptions,
  ListResult,
} from '@/types/storage';
import type { Diagram, DiagramInfo } from '@/types/diagram';
import type { AppError } from '@/types/common';

/**
 * Abstract base class for storage adapters
 * Provides common functionality and enforces the StorageAdapter interface
 */
export abstract class BaseStorageAdapter implements StorageAdapter {
  abstract readonly name: string;
  abstract readonly canRead: boolean;
  abstract readonly canWrite: boolean;
  abstract readonly canList: boolean;

  /**
   * Validates that the adapter can perform the requested operation
   * @param operation The operation to validate
   * @throws Error if operation is not supported
   */
  protected validateOperation(operation: 'read' | 'write' | 'list'): void {
    switch (operation) {
      case 'read':
        if (!this.canRead) {
          throw this.createError(
            'OPERATION_NOT_SUPPORTED',
            `Adapter '${this.name}' does not support read operations`
          );
        }
        break;
      case 'write':
        if (!this.canWrite) {
          throw this.createError(
            'OPERATION_NOT_SUPPORTED',
            `Adapter '${this.name}' does not support write operations`
          );
        }
        break;
      case 'list':
        if (!this.canList) {
          throw this.createError(
            'OPERATION_NOT_SUPPORTED',
            `Adapter '${this.name}' does not support list operations`
          );
        }
        break;
    }
  }

  /**
   * Validates diagram data structure
   * @param diagram The diagram to validate
   * @throws Error if diagram is invalid
   */
  protected validateDiagram(diagram: Diagram): void {
    if (!diagram) {
      throw this.createError('INVALID_DIAGRAM', 'Diagram cannot be null or undefined');
    }

    if (!diagram.id || typeof diagram.id !== 'string') {
      throw this.createError('INVALID_DIAGRAM', 'Diagram must have a valid ID');
    }

    if (!diagram.name || typeof diagram.name !== 'string') {
      throw this.createError('INVALID_DIAGRAM', 'Diagram must have a valid name');
    }

    if (!Array.isArray(diagram.elements)) {
      throw this.createError('INVALID_DIAGRAM', 'Diagram must have an elements array');
    }

    if (!diagram.viewport || typeof diagram.viewport !== 'object') {
      throw this.createError('INVALID_DIAGRAM', 'Diagram must have a valid viewport');
    }

    if (!diagram.metadata || typeof diagram.metadata !== 'object') {
      throw this.createError('INVALID_DIAGRAM', 'Diagram must have valid metadata');
    }

    if (typeof diagram.version !== 'number') {
      throw this.createError('INVALID_DIAGRAM', 'Diagram must have a numeric version');
    }
  }

  /**
   * Validates diagram ID format
   * @param id The ID to validate
   * @throws Error if ID is invalid
   */
  protected validateId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw this.createError('INVALID_ID', 'ID must be a non-empty string');
    }
  }

  /**
   * Creates a standardized error object
   * @param code Error code
   * @param message Error message
   * @param details Additional error details
   * @returns Formatted AppError
   */
  protected createError(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): AppError {
    return {
      code: `STORAGE_${code}`,
      message,
      details: {
        adapter: this.name,
        timestamp: Date.now(),
        ...details,
      },
    };
  }

  /**
   * Wraps async operations with error handling
   * @param operation The async operation to perform
   * @param operationName Name of the operation for error reporting
   * @returns Promise with standardized error handling
   */
  protected async wrapOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const appError =
        error instanceof Error
          ? this.createError('OPERATION_FAILED', `${operationName} failed: ${error.message}`, {
              originalError: error.name,
              stack: error.stack,
            })
          : this.createError('UNKNOWN_ERROR', `Unknown error during ${operationName}`, {
              error: String(error),
            });

      throw appError;
    }
  }

  /**
   * Creates a successful save result
   * @param id The diagram ID
   * @param path Optional file path
   * @param size Optional file size
   * @param metadata Optional additional metadata
   * @returns SaveResult object
   */
  protected createSaveResult(
    id: string,
    path?: string,
    size?: number,
    metadata?: Record<string, unknown>
  ): SaveResult {
    const result: SaveResult = {
      success: true,
      id,
    };

    if (path !== undefined) {
      result.path = path;
    }
    if (size !== undefined) {
      result.size = size;
    }
    if (metadata !== undefined) {
      result.metadata = metadata;
    }

    return result;
  }

  /**
   * Creates a successful load result
   * @param diagram The loaded diagram
   * @param metadata Optional diagram metadata
   * @returns LoadResult object
   */
  protected createLoadResult(diagram: Diagram, metadata?: DiagramInfo): LoadResult {
    const result: LoadResult = {
      success: true,
      diagram,
    };

    if (metadata !== undefined) {
      result.metadata = metadata;
    }

    return result;
  }

  /**
   * Creates a failed operation result
   * @param error The error that occurred
   * @returns Result object with error
   */
  protected createErrorResult(error: AppError): any {
    return {
      success: false,
      error,
    };
  }

  /**
   * Applies default save options
   * @param options User-provided options
   * @returns Options with defaults applied
   */
  protected applySaveDefaults(options?: SaveOptions): Required<SaveOptions> {
    return {
      backup: options?.backup ?? true,
      filename: options?.filename ?? '',
      compress: options?.compress ?? false,
      metadata: options?.metadata ?? {},
    };
  }

  /**
   * Applies default load options
   * @param options User-provided options
   * @returns Options with defaults applied
   */
  protected applyLoadDefaults(options?: LoadOptions): Required<LoadOptions> {
    return {
      includeElements: options?.includeElements ?? true,
      version: options?.version ?? '',
      validate: options?.validate ?? true,
    };
  }

  /**
   * Applies default list options
   * @param options User-provided options
   * @returns Options with defaults applied
   */
  protected applyListDefaults(options?: ListOptions): Required<ListOptions> {
    return {
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
      sortBy: options?.sortBy ?? 'modified',
      sortOrder: options?.sortOrder ?? 'desc',
      nameFilter: options?.nameFilter ?? '',
      tags: options?.tags ?? [],
      dateRange: options?.dateRange ?? {},
    };
  }

  // Abstract methods that concrete adapters must implement
  abstract save(diagram: Diagram, options?: SaveOptions): Promise<SaveResult>;
  abstract load(id: string, options?: LoadOptions): Promise<LoadResult>;
  abstract delete(id: string): Promise<DeleteResult>;
  abstract list(options?: ListOptions): Promise<ListResult>;
  abstract exists(id: string): Promise<boolean>;
  abstract getMetadata(id: string): Promise<DiagramInfo>;
}

/**
 * Storage operation utilities
 */
export class StorageUtils {
  /**
   * Generates a unique diagram ID
   * @returns Unique string ID
   */
  static generateId(): string {
    return `diagram_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitizes a filename for safe storage
   * @param name The filename to sanitize
   * @returns Safe filename
   */
  static sanitizeFilename(name: string): string {
    return name
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase()
      .substr(0, 100); // Limit length
  }

  /**
   * Calculates the size of a diagram in bytes
   * @param diagram The diagram to measure
   * @returns Size in bytes
   */
  static calculateDiagramSize(diagram: Diagram): number {
    return new TextEncoder().encode(JSON.stringify(diagram)).length;
  }

  /**
   * Validates file extension
   * @param filename The filename to check
   * @param allowedExtensions Array of allowed extensions
   * @returns True if extension is allowed
   */
  static isValidExtension(filename: string, allowedExtensions: string[]): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? allowedExtensions.includes(extension) : false;
  }

  /**
   * Extracts diagram metadata for lightweight operations
   * @param diagram The full diagram
   * @returns Lightweight diagram info
   */
  static extractDiagramInfo(diagram: Diagram): DiagramInfo {
    const info: DiagramInfo = {
      id: diagram.id,
      name: diagram.name,
      lastModified: diagram.metadata.updatedAt,
      fileSize: diagram.metadata.fileSize ?? StorageUtils.calculateDiagramSize(diagram),
    };

    if (diagram.metadata.thumbnail !== undefined) {
      info.thumbnail = diagram.metadata.thumbnail;
    }

    return info;
  }

  /**
   * Creates a backup copy of a diagram with timestamp
   * @param diagram The diagram to backup
   * @returns Modified diagram with backup metadata
   */
  static createBackup(diagram: Diagram): Diagram {
    const timestamp = Date.now();
    return {
      ...diagram,
      id: `${diagram.id}_backup_${timestamp}`,
      name: `${diagram.name} (Backup ${new Date(timestamp).toLocaleString()})`,
      metadata: {
        ...diagram.metadata,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    };
  }

  /**
   * Compresses diagram data (placeholder for actual compression)
   * @param data The data to compress
   * @returns Compressed data (currently just JSON string)
   */
  static compress(data: Diagram): string {
    // TODO: Implement actual compression algorithm (e.g., gzip, lz4)
    return JSON.stringify(data);
  }

  /**
   * Decompresses diagram data (placeholder for actual decompression)
   * @param data The data to decompress
   * @returns Decompressed diagram
   */
  static decompress(data: string): Diagram {
    // TODO: Implement actual decompression algorithm
    return JSON.parse(data);
  }

  /**
   * Validates diagram data integrity
   * @param diagram The diagram to validate
   * @returns True if diagram is valid
   */
  static validateDiagramIntegrity(diagram: Diagram): boolean {
    try {
      // Check required fields
      if (!diagram.id || !diagram.name || !Array.isArray(diagram.elements)) {
        return false;
      }

      // Check viewport structure
      if (
        !diagram.viewport ||
        typeof diagram.viewport.zoom !== 'number' ||
        !diagram.viewport.offset ||
        typeof diagram.viewport.offset.x !== 'number' ||
        typeof diagram.viewport.offset.y !== 'number'
      ) {
        return false;
      }

      // Check metadata structure
      if (!diagram.metadata || typeof diagram.metadata.createdAt !== 'number') {
        return false;
      }

      // Validate element structure
      for (const element of diagram.elements) {
        if (!element.id || !element.type) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}
