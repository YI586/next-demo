/**
 * StorageManager - Coordinates different storage adapters and manages storage operations
 */

import type {
  StorageAdapter,
  StorageConfig,
  StorageOperationStatus,
  SaveOptions,
  SaveResult,
  LoadOptions,
  LoadResult,
  DeleteResult,
  ListOptions,
  ListResult,
} from '@/types/storage';
import type { Diagram, DiagramInfo } from '@/types/diagram';
import { LoadingState, type AppError } from '@/types/common';

/**
 * Events emitted by the StorageManager
 */
export interface StorageManagerEvents {
  'operation-start': StorageOperationStatus;
  'operation-progress': StorageOperationStatus;
  'operation-complete': StorageOperationStatus;
  'operation-error': StorageOperationStatus;
  'adapter-registered': { name: string; adapter: StorageAdapter };
  'adapter-unregistered': { name: string };
  'default-adapter-changed': { previous: string; current: string };
}

/**
 * Event callback type
 */
export type StorageEventCallback<
  T extends keyof StorageManagerEvents = keyof StorageManagerEvents,
> = (event: StorageManagerEvents[T]) => void;

/**
 * StorageManager class - coordinates multiple storage adapters
 */
export class StorageManager {
  private adapters = new Map<string, StorageAdapter>();
  private defaultAdapterName = '';
  private eventListeners = new Map<keyof StorageManagerEvents, Set<StorageEventCallback>>();
  private _operationId = 0;

  constructor(private config: Partial<StorageConfig> = {}) {
    this.setupDefaultConfig();
  }

  /**
   * Sets up default configuration values
   */
  private setupDefaultConfig(): void {
    this.config = {
      defaultAdapter: this.config.defaultAdapter || '',
      adapters: this.config.adapters || {},
      options: {
        autoSave: this.config.options?.autoSave ?? true,
        autoSaveInterval: this.config.options?.autoSaveInterval ?? 30000,
        maxBackups: this.config.options?.maxBackups ?? 5,
        validateOnLoad: this.config.options?.validateOnLoad ?? true,
        ...this.config.options,
      },
    };
  }

  /**
   * Registers a storage adapter
   * @param name Unique name for the adapter
   * @param adapter The adapter instance
   */
  registerAdapter(name: string, adapter: StorageAdapter): void {
    if (this.adapters.has(name)) {
      throw this.createError(
        'ADAPTER_ALREADY_EXISTS',
        `Adapter with name '${name}' is already registered`
      );
    }

    this.adapters.set(name, adapter);

    // Set as default if no default is set
    if (!this.defaultAdapterName) {
      this.defaultAdapterName = name;
    }

    this.emit('adapter-registered', { name, adapter });
  }

  /**
   * Unregisters a storage adapter
   * @param name Name of the adapter to unregister
   */
  unregisterAdapter(name: string): void {
    if (!this.adapters.has(name)) {
      throw this.createError('ADAPTER_NOT_FOUND', `Adapter with name '${name}' is not registered`);
    }

    this.adapters.delete(name);

    // Update default adapter if necessary
    if (this.defaultAdapterName === name) {
      const remainingAdapters = Array.from(this.adapters.keys());
      this.defaultAdapterName = remainingAdapters[0] || '';

      if (this.defaultAdapterName) {
        this.emit('default-adapter-changed', { previous: name, current: this.defaultAdapterName });
      }
    }

    this.emit('adapter-unregistered', { name });
  }

  /**
   * Gets a registered adapter by name
   * @param name Name of the adapter (optional, uses default if not provided)
   * @returns The adapter instance
   */
  getAdapter(name?: string): StorageAdapter {
    const adapterName = name || this.defaultAdapterName;

    if (!adapterName) {
      throw this.createError('NO_DEFAULT_ADAPTER', 'No default adapter is set');
    }

    const adapter = this.adapters.get(adapterName);
    if (!adapter) {
      throw this.createError(
        'ADAPTER_NOT_FOUND',
        `Adapter with name '${adapterName}' is not registered`
      );
    }

    return adapter;
  }

  /**
   * Sets the default adapter
   * @param name Name of the adapter to set as default
   */
  setDefaultAdapter(name: string): void {
    if (!this.adapters.has(name)) {
      throw this.createError('ADAPTER_NOT_FOUND', `Adapter with name '${name}' is not registered`);
    }

    const previous = this.defaultAdapterName;
    this.defaultAdapterName = name;

    this.emit('default-adapter-changed', { previous, current: name });
  }

  /**
   * Gets the name of the default adapter
   * @returns Name of the default adapter
   */
  getDefaultAdapterName(): string {
    return this.defaultAdapterName;
  }

  /**
   * Lists all registered adapters
   * @returns Array of adapter names and their capabilities
   */
  listAdapters(): Array<{ name: string; canRead: boolean; canWrite: boolean; canList: boolean }> {
    return Array.from(this.adapters.entries()).map(([name, adapter]) => ({
      name,
      canRead: adapter.canRead,
      canWrite: adapter.canWrite,
      canList: adapter.canList,
    }));
  }

  /**
   * Saves a diagram using the specified or default adapter
   * @param diagram The diagram to save
   * @param options Save options
   * @param adapterName Optional adapter name (uses default if not provided)
   * @returns Promise resolving to save result
   */
  async save(diagram: Diagram, options?: SaveOptions, adapterName?: string): Promise<SaveResult> {
    const adapter = this.getAdapter(adapterName);

    const status: StorageOperationStatus = {
      operation: 'save',
      status: LoadingState.LOADING,
    };

    this.emit('operation-start', status);

    try {
      const result = await adapter.save(diagram, options);

      this.emit('operation-complete', {
        ...status,
        status: LoadingState.SUCCESS,
      });

      return result;
    } catch (error) {
      const appError = error as AppError;

      this.emit('operation-error', {
        ...status,
        status: LoadingState.ERROR,
        error: appError,
      });

      throw error;
    }
  }

  /**
   * Loads a diagram using the specified or default adapter
   * @param id The diagram ID to load
   * @param options Load options
   * @param adapterName Optional adapter name (uses default if not provided)
   * @returns Promise resolving to load result
   */
  async load(id: string, options?: LoadOptions, adapterName?: string): Promise<LoadResult> {
    const adapter = this.getAdapter(adapterName);

    const status: StorageOperationStatus = {
      operation: 'load',
      status: LoadingState.LOADING,
    };

    this.emit('operation-start', status);

    try {
      const result = await adapter.load(id, options);

      // Validate loaded diagram if configured to do so
      if (this.config.options?.validateOnLoad && result.diagram) {
        this.validateDiagramData(result.diagram);
      }

      this.emit('operation-complete', {
        ...status,
        status: LoadingState.SUCCESS,
      });

      return result;
    } catch (error) {
      const appError = error as AppError;

      this.emit('operation-error', {
        ...status,
        status: LoadingState.ERROR,
        error: appError,
      });

      throw error;
    }
  }

  /**
   * Deletes a diagram using the specified or default adapter
   * @param id The diagram ID to delete
   * @param adapterName Optional adapter name (uses default if not provided)
   * @returns Promise resolving to delete result
   */
  async delete(id: string, adapterName?: string): Promise<DeleteResult> {
    const adapter = this.getAdapter(adapterName);

    const status: StorageOperationStatus = {
      operation: 'delete',
      status: LoadingState.LOADING,
    };

    this.emit('operation-start', status);

    try {
      const result = await adapter.delete(id);

      this.emit('operation-complete', {
        ...status,
        status: LoadingState.SUCCESS,
      });

      return result;
    } catch (error) {
      const appError = error as AppError;

      this.emit('operation-error', {
        ...status,
        status: LoadingState.ERROR,
        error: appError,
      });

      throw error;
    }
  }

  /**
   * Lists diagrams using the specified or default adapter
   * @param options List options
   * @param adapterName Optional adapter name (uses default if not provided)
   * @returns Promise resolving to list result
   */
  async list(options?: ListOptions, adapterName?: string): Promise<ListResult> {
    const adapter = this.getAdapter(adapterName);

    const status: StorageOperationStatus = {
      operation: 'list',
      status: LoadingState.LOADING,
    };

    this.emit('operation-start', status);

    try {
      const result = await adapter.list(options);

      this.emit('operation-complete', {
        ...status,
        status: LoadingState.SUCCESS,
      });

      return result;
    } catch (error) {
      const appError = error as AppError;

      this.emit('operation-error', {
        ...status,
        status: LoadingState.ERROR,
        error: appError,
      });

      throw error;
    }
  }

  /**
   * Checks if a diagram exists using the specified or default adapter
   * @param id The diagram ID to check
   * @param adapterName Optional adapter name (uses default if not provided)
   * @returns Promise resolving to existence status
   */
  async exists(id: string, adapterName?: string): Promise<boolean> {
    const adapter = this.getAdapter(adapterName);
    return adapter.exists(id);
  }

  /**
   * Gets diagram metadata using the specified or default adapter
   * @param id The diagram ID
   * @param adapterName Optional adapter name (uses default if not provided)
   * @returns Promise resolving to diagram metadata
   */
  async getMetadata(id: string, adapterName?: string): Promise<DiagramInfo> {
    const adapter = this.getAdapter(adapterName);
    return adapter.getMetadata(id);
  }

  /**
   * Registers an event listener
   * @param event The event to listen for
   * @param callback The callback function
   */
  on<T extends keyof StorageManagerEvents>(event: T, callback: StorageEventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(callback as StorageEventCallback);
    }
  }

  /**
   * Removes an event listener
   * @param event The event to stop listening for
   * @param callback The callback function to remove
   */
  off<T extends keyof StorageManagerEvents>(event: T, callback: StorageEventCallback<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback as StorageEventCallback);
    }
  }

  /**
   * Emits an event to all registered listeners
   * @param event The event to emit
   * @param data The event data
   */
  private emit<T extends keyof StorageManagerEvents>(
    event: T,
    data: StorageManagerEvents[T]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (listenerError) {
          // Silently ignore listener errors to prevent disrupting storage operations
        }
      });
    }
  }

  /**
   * Creates a standardized error object
   * @param code Error code
   * @param message Error message
   * @param details Additional error details
   * @returns Formatted AppError
   */
  private createError(code: string, message: string, details?: Record<string, unknown>): AppError {
    return {
      code: `STORAGE_MANAGER_${code}`,
      message,
      details: {
        timestamp: Date.now(),
        ...details,
      },
    };
  }

  /**
   * Basic diagram data validation
   * @param diagram The diagram to validate
   * @throws Error if diagram is invalid
   */
  private validateDiagramData(diagram: Diagram): void {
    if (!diagram || typeof diagram !== 'object') {
      throw this.createError('INVALID_DIAGRAM', 'Diagram must be a valid object');
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
  }

  /**
   * Gets the current storage configuration
   * @returns Current storage configuration
   */
  getConfig(): Partial<StorageConfig> {
    return { ...this.config };
  }

  /**
   * Updates the storage configuration
   * @param config Partial configuration to merge
   */
  updateConfig(config: Partial<StorageConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      options: {
        ...this.config.options,
        ...config.options,
      } as StorageConfig['options'],
    };
  }

  /**
   * Disposes of the storage manager and cleans up resources
   */
  dispose(): void {
    this.adapters.clear();
    this.eventListeners.clear();
    this.defaultAdapterName = '';
  }
}
