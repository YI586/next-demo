/**
 * File storage adapter for browser-based JSON file operations
 * Supports save/load/delete operations through browser file APIs
 */

import type {
  SaveOptions,
  SaveResult,
  LoadOptions,
  LoadResult,
  DeleteResult,
  ListOptions,
  ListResult,
  FileStorageOptions,
} from '@/types/storage';
import type { Diagram, DiagramInfo, DiagramFile, FileFormatVersion } from '@/types/diagram';

import { BaseStorageAdapter, StorageUtils } from '../storage-adapter';

// File System Access API type declarations (not yet in TypeScript by default)
interface FileSystemAccessWindow extends Window {
  showSaveFilePicker(options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }): Promise<FileSystemFileHandle>;
}

/**
 * File storage adapter that handles browser-based file operations
 * Uses File System Access API when available, with fallback to download/upload
 */
export class FileStorageAdapter extends BaseStorageAdapter {
  readonly name = 'file';
  readonly canRead = true;
  readonly canWrite = true;
  readonly canList = false; // Browser storage cannot list files

  private options: FileStorageOptions;
  private fileHandles: Map<string, FileSystemFileHandle> = new Map();

  constructor(options: FileStorageOptions = {}) {
    super();
    this.options = {
      defaultDirectory: options.defaultDirectory || 'excalidraw-diagrams',
      allowedExtensions: options.allowedExtensions || ['json'],
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB default
      useCompression: options.useCompression || false,
    };
  }

  /**
   * Saves a diagram as a JSON file using browser download or File System Access API
   */
  async save(diagram: Diagram, options?: SaveOptions): Promise<SaveResult> {
    return this.wrapOperation(async () => {
      this.validateOperation('write');
      this.validateDiagram(diagram);

      const saveOptions = this.applySaveDefaults(options);
      const filename = this.generateFilename(diagram, saveOptions);

      // Create backup if requested
      let backupResult: SaveResult | null = null;
      if (saveOptions.backup && (await this.exists(diagram.id))) {
        const backupDiagram = StorageUtils.createBackup(diagram);
        backupResult = await this.saveInternal(backupDiagram, `${filename}.backup`);
      }

      // Save the main diagram
      const result = await this.saveInternal(diagram, filename);

      // Include backup information in metadata
      if (backupResult) {
        result.metadata = {
          ...result.metadata,
          backup: {
            id: backupResult.id,
            path: backupResult.path,
          },
        };
      }

      return result;
    }, 'save diagram');
  }

  /**
   * Loads a diagram from a JSON file using file input
   */
  async load(id: string, options?: LoadOptions): Promise<LoadResult> {
    return this.wrapOperation(async () => {
      this.validateOperation('read');
      this.validateId(id);

      const loadOptions = this.applyLoadDefaults(options);

      // Try to load from stored file handle first
      if (this.fileHandles.has(id) && this.supportsFileSystemAccess()) {
        return await this.loadFromFileHandle(id, loadOptions);
      }

      // Fallback to file input dialog
      return await this.loadFromFileInput(loadOptions);
    }, 'load diagram');
  }

  /**
   * Deletes a diagram (removes file handle reference)
   */
  async delete(id: string): Promise<DeleteResult> {
    return this.wrapOperation(async () => {
      this.validateId(id);

      // Remove file handle if exists
      if (this.fileHandles.has(id)) {
        this.fileHandles.delete(id);
      }

      return { success: true };
    }, 'delete diagram');
  }

  /**
   * Lists available diagrams (not supported for browser file storage)
   */
  async list(_options?: ListOptions): Promise<ListResult> {
    return Promise.resolve(
      this.createErrorResult(
        this.createError(
          'OPERATION_NOT_SUPPORTED',
          'File adapter cannot list files in browser environment'
        )
      )
    );
  }

  /**
   * Checks if a diagram exists (checks for file handle)
   */
  async exists(id: string): Promise<boolean> {
    this.validateId(id);
    return this.fileHandles.has(id);
  }

  /**
   * Gets metadata for a diagram (requires loading the full file)
   */
  async getMetadata(id: string): Promise<DiagramInfo> {
    return this.wrapOperation(async () => {
      this.validateId(id);

      const loadResult = await this.load(id, { includeElements: false });
      if (!loadResult.success || !loadResult.diagram) {
        throw this.createError('LOAD_FAILED', 'Cannot load diagram to get metadata');
      }

      return StorageUtils.extractDiagramInfo(loadResult.diagram);
    }, 'get diagram metadata');
  }

  /**
   * Internal save implementation
   */
  private async saveInternal(diagram: Diagram, filename: string): Promise<SaveResult> {
    const diagramFile = this.createDiagramFile(diagram);
    const jsonData = this.options.useCompression
      ? StorageUtils.compress(diagramFile.diagram)
      : JSON.stringify(diagramFile, null, 2);

    const size = new TextEncoder().encode(jsonData).length;

    // Check file size limit
    const maxSize = this.options.maxFileSize ?? 50 * 1024 * 1024;
    if (size > maxSize) {
      throw this.createError(
        'FILE_TOO_LARGE',
        `File size (${size} bytes) exceeds maximum allowed size (${maxSize} bytes)`
      );
    }

    // Try File System Access API first
    if (this.supportsFileSystemAccess()) {
      return await this.saveWithFileSystemAccess(diagram, jsonData, filename, size);
    }

    // Fallback to download
    return await this.saveWithDownload(diagram, jsonData, filename, size);
  }

  /**
   * Save using File System Access API
   */
  private async saveWithFileSystemAccess(
    diagram: Diagram,
    jsonData: string,
    filename: string,
    size: number
  ): Promise<SaveResult> {
    try {
      const fileHandle = await (window as unknown as FileSystemAccessWindow).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Excalidraw diagrams',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });

      const writable = await fileHandle.createWritable();
      await writable.write(jsonData);
      await writable.close();

      // Store file handle for future operations
      this.fileHandles.set(diagram.id, fileHandle);

      return this.createSaveResult(diagram.id, fileHandle.name, size, {
        method: 'file-system-access',
        filename: fileHandle.name,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError('OPERATION_CANCELLED', 'File save was cancelled by user');
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw this.createError('SAVE_FAILED', `File System Access API save failed: ${errorMessage}`);
    }
  }

  /**
   * Save using download fallback
   */
  private async saveWithDownload(
    diagram: Diagram,
    jsonData: string,
    filename: string,
    size: number
  ): Promise<SaveResult> {
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return this.createSaveResult(diagram.id, filename, size, {
        method: 'download',
        filename,
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Load from stored file handle
   */
  private async loadFromFileHandle(
    id: string,
    options: Required<LoadOptions>
  ): Promise<LoadResult> {
    const fileHandle = this.fileHandles.get(id);
    if (!fileHandle) {
      throw this.createError('FILE_HANDLE_NOT_FOUND', 'File handle not found for diagram');
    }

    try {
      const file = await fileHandle.getFile();
      return await this.processFileLoad(file, options);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw this.createError('LOAD_FAILED', `Failed to load from file handle: ${errorMessage}`);
    }
  }

  /**
   * Load from file input dialog
   */
  private async loadFromFileInput(options: Required<LoadOptions>): Promise<LoadResult> {
    return new Promise((resolve, reject) => {
      const { createElement } = document;
      const input = createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';

      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(this.createError('NO_FILE_SELECTED', 'No file was selected'));
          return;
        }

        try {
          const result = await this.processFileLoad(file, options);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          document.body.removeChild(input);
        }
      };

      input.oncancel = () => {
        document.body.removeChild(input);
        reject(this.createError('OPERATION_CANCELLED', 'File selection was cancelled'));
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Process loaded file data
   */
  private async processFileLoad(file: File, options: Required<LoadOptions>): Promise<LoadResult> {
    // Validate file extension
    const allowedExtensions = this.options.allowedExtensions ?? ['json'];
    if (!StorageUtils.isValidExtension(file.name, allowedExtensions)) {
      throw this.createError(
        'INVALID_FILE_EXTENSION',
        `File extension not allowed. Allowed: ${allowedExtensions.join(', ')}`
      );
    }

    // Check file size
    const maxFileSize = this.options.maxFileSize ?? 50 * 1024 * 1024;
    if (file.size > maxFileSize) {
      throw this.createError(
        'FILE_TOO_LARGE',
        `File size (${file.size} bytes) exceeds maximum allowed size (${maxFileSize} bytes)`
      );
    }

    const text = await file.text();

    try {
      // Try to parse as DiagramFile first
      let diagramFile: DiagramFile;
      let diagram: Diagram;

      try {
        diagramFile = JSON.parse(text) as DiagramFile;

        // Validate file format
        if (this.isDiagramFile(diagramFile)) {
          const { diagram: diagramData } = diagramFile;
          diagram = diagramData;
        } else {
          // Try parsing as direct diagram
          const parsedData = JSON.parse(text) as Diagram;
          diagram = parsedData;
        }
      } catch (parseError) {
        // Try decompression if compression is enabled
        if (this.options.useCompression) {
          diagram = StorageUtils.decompress(text);
        } else {
          throw parseError;
        }
      }

      // Validate diagram data
      if (options.validate && !StorageUtils.validateDiagramIntegrity(diagram)) {
        throw this.createError('INVALID_DIAGRAM_FORMAT', 'Diagram data is corrupted or invalid');
      }

      // Update diagram metadata
      diagram.metadata.updatedAt = Date.now();
      diagram.metadata.fileSize = file.size;

      // Store file handle if using File System Access API
      if (this.supportsFileSystemAccess()) {
        const fileWithHandle = file as File & { handle?: FileSystemFileHandle };
        if (fileWithHandle.handle) {
          this.fileHandles.set(diagram.id, fileWithHandle.handle);
        }
      }

      const metadata = StorageUtils.extractDiagramInfo(diagram);
      return this.createLoadResult(diagram, metadata);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw this.createError('PARSE_FAILED', `Failed to parse diagram file: ${errorMessage}`);
    }
  }

  /**
   * Creates a DiagramFile structure for export
   */
  private createDiagramFile(diagram: Diagram): DiagramFile {
    return {
      version: '1.0.0' as FileFormatVersion,
      diagram,
      exportedAt: Date.now(),
      exportedBy: 'excalidraw-mvp',
    };
  }

  /**
   * Generates appropriate filename for saving
   */
  private generateFilename(diagram: Diagram, options: Required<SaveOptions>): string {
    if (options.filename) {
      return options.filename.endsWith('.json') ? options.filename : `${options.filename}.json`;
    }

    const sanitizedName = StorageUtils.sanitizeFilename(diagram.name);
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${sanitizedName}_${timestamp}.json`;
  }

  /**
   * Checks if the loaded data is a DiagramFile
   */
  private isDiagramFile(data: unknown): data is DiagramFile {
    return (
      data !== null &&
      typeof data === 'object' &&
      'version' in data &&
      'diagram' in data &&
      'exportedAt' in data &&
      typeof (data as { diagram: unknown }).diagram === 'object'
    );
  }

  /**
   * Checks if File System Access API is supported
   */
  private supportsFileSystemAccess(): boolean {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  }

  /**
   * Gets information about browser file API support
   */
  getCapabilities() {
    return {
      fileSystemAccess: this.supportsFileSystemAccess(),
      compression: this.options.useCompression,
      maxFileSize: this.options.maxFileSize,
      allowedExtensions: this.options.allowedExtensions,
    };
  }

  /**
   * Clears all stored file handles
   */
  clearFileHandles(): void {
    this.fileHandles.clear();
  }

  /**
   * Gets count of stored file handles
   */
  getFileHandleCount(): number {
    return this.fileHandles.size;
  }
}

/**
 * Utility functions for file operations
 */
export class FileStorageUtils {
  /**
   * Creates a new FileStorageAdapter with default options
   */
  static createDefaultAdapter(): FileStorageAdapter {
    return new FileStorageAdapter({
      defaultDirectory: 'excalidraw-diagrams',
      allowedExtensions: ['json'],
      maxFileSize: 50 * 1024 * 1024, // 50MB
      useCompression: false,
    });
  }

  /**
   * Validates file format before processing
   */
  static async validateFileFormat(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Check if it's a valid diagram or diagram file
      return (
        FileStorageUtils.isValidDiagram(data) ||
        (data.diagram && FileStorageUtils.isValidDiagram(data.diagram))
      );
    } catch {
      return false;
    }
  }

  /**
   * Checks if data structure is a valid diagram
   */
  private static isValidDiagram(data: unknown): boolean {
    return (
      data !== null &&
      typeof data === 'object' &&
      'id' in data &&
      'name' in data &&
      'elements' in data &&
      Array.isArray((data as { elements: unknown }).elements) &&
      'viewport' in data &&
      'metadata' in data
    );
  }

  /**
   * Extracts diagram info from file without full parsing
   */
  static async extractFileInfo(
    file: File
  ): Promise<{ name: string; size: number; lastModified: number }> {
    return {
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      size: file.size,
      lastModified: file.lastModified,
    };
  }

  /**
   * Creates a download link for a diagram
   */
  static createDownloadLink(diagram: Diagram, _filename?: string): string {
    const diagramFile: DiagramFile = {
      version: '1.0.0' as FileFormatVersion,
      diagram,
      exportedAt: Date.now(),
      exportedBy: 'excalidraw-mvp',
    };

    const jsonData = JSON.stringify(diagramFile, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    return URL.createObjectURL(blob);
  }

  /**
   * Triggers a download for a diagram
   */
  static downloadDiagram(diagram: Diagram, filename?: string): void {
    const url = FileStorageUtils.createDownloadLink(diagram, filename);
    const finalFilename = filename || `${StorageUtils.sanitizeFilename(diagram.name)}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}
