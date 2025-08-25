/**
 * Storage configuration utilities and factory functions
 */

import type {
  StorageConfig,
  StorageAdapter,
  FileStorageOptions,
  CloudStorageOptions,
  DatabaseStorageOptions,
} from '@/types/storage';

import { StorageManager } from './storage-manager';

/**
 * Default storage configuration
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  defaultAdapter: 'file',
  adapters: {},
  options: {
    autoSave: true,
    autoSaveInterval: 30000, // 30 seconds
    maxBackups: 5,
    validateOnLoad: true,
  },
};

/**
 * Storage configuration builder for creating typed configurations
 */
export class StorageConfigBuilder {
  private config: Partial<StorageConfig> = {};

  /**
   * Sets the default adapter name
   * @param adapterName Name of the default adapter
   * @returns Builder instance for chaining
   */
  setDefaultAdapter(adapterName: string): this {
    this.config.defaultAdapter = adapterName;
    return this;
  }

  /**
   * Adds an adapter to the configuration
   * @param name Adapter name
   * @param adapter Adapter instance
   * @returns Builder instance for chaining
   */
  addAdapter(name: string, adapter: StorageAdapter): this {
    if (!this.config.adapters) {
      this.config.adapters = {};
    }
    this.config.adapters[name] = adapter;
    return this;
  }

  /**
   * Sets global storage options
   * @param options Storage options
   * @returns Builder instance for chaining
   */
  setOptions(options: Partial<StorageConfig['options']>): this {
    this.config.options = {
      ...DEFAULT_STORAGE_CONFIG.options,
      ...this.config.options,
      ...options,
    };
    return this;
  }

  /**
   * Enables auto-save functionality
   * @param interval Auto-save interval in milliseconds
   * @returns Builder instance for chaining
   */
  enableAutoSave(interval: number = 30000): this {
    this.config.options = {
      ...DEFAULT_STORAGE_CONFIG.options,
      ...this.config.options,
      autoSave: true,
      autoSaveInterval: interval,
    };
    return this;
  }

  /**
   * Disables auto-save functionality
   * @returns Builder instance for chaining
   */
  disableAutoSave(): this {
    this.config.options = {
      ...DEFAULT_STORAGE_CONFIG.options,
      ...this.config.options,
      autoSave: false,
    };
    return this;
  }

  /**
   * Sets the maximum number of backups to keep
   * @param maxBackups Maximum number of backups
   * @returns Builder instance for chaining
   */
  setMaxBackups(maxBackups: number): this {
    this.config.options = {
      ...DEFAULT_STORAGE_CONFIG.options,
      ...this.config.options,
      maxBackups,
    };
    return this;
  }

  /**
   * Enables or disables validation on load
   * @param validate Whether to validate diagrams on load
   * @returns Builder instance for chaining
   */
  setValidateOnLoad(validate: boolean): this {
    this.config.options = {
      ...DEFAULT_STORAGE_CONFIG.options,
      ...this.config.options,
      validateOnLoad: validate,
    };
    return this;
  }

  /**
   * Builds the configuration
   * @returns Complete storage configuration
   */
  build(): StorageConfig {
    return {
      ...DEFAULT_STORAGE_CONFIG,
      ...this.config,
      options: {
        ...DEFAULT_STORAGE_CONFIG.options,
        ...this.config.options,
      },
    };
  }

  /**
   * Creates a storage manager with the built configuration
   * @returns Configured StorageManager instance
   */
  createManager(): StorageManager {
    const config = this.build();
    const manager = new StorageManager(config);

    // Register all adapters
    Object.entries(config.adapters).forEach(([name, adapter]) => {
      manager.registerAdapter(name, adapter);
    });

    // Set default adapter
    if (config.defaultAdapter && config.adapters[config.defaultAdapter]) {
      manager.setDefaultAdapter(config.defaultAdapter);
    }

    return manager;
  }
}

/**
 * Configuration presets for common use cases
 */
export class StorageConfigPresets {
  /**
   * Creates a basic file-only storage configuration
   * @param options File storage options
   * @returns Storage configuration builder
   */
  static fileOnly(_options?: FileStorageOptions): StorageConfigBuilder {
    return new StorageConfigBuilder()
      .setDefaultAdapter('file')
      .setValidateOnLoad(true)
      .enableAutoSave();
  }

  /**
   * Creates a cloud-first storage configuration with file fallback
   * @param cloudOptions Cloud storage options
   * @param fileOptions File storage options for fallback
   * @returns Storage configuration builder
   */
  static cloudWithFallback(
    _cloudOptions?: CloudStorageOptions,
    _fileOptions?: FileStorageOptions
  ): StorageConfigBuilder {
    return new StorageConfigBuilder()
      .setDefaultAdapter('cloud')
      .setValidateOnLoad(true)
      .enableAutoSave(60000); // Longer interval for cloud
  }

  /**
   * Creates a database storage configuration
   * @param databaseOptions Database storage options
   * @returns Storage configuration builder
   */
  static database(_databaseOptions: DatabaseStorageOptions): StorageConfigBuilder {
    return new StorageConfigBuilder()
      .setDefaultAdapter('database')
      .setValidateOnLoad(true)
      .enableAutoSave(45000) // 45 seconds for database
      .setMaxBackups(10);
  }

  /**
   * Creates a development configuration with enhanced debugging
   * @returns Storage configuration builder
   */
  static development(): StorageConfigBuilder {
    return new StorageConfigBuilder()
      .setDefaultAdapter('file')
      .setValidateOnLoad(true)
      .disableAutoSave() // Manual save in development
      .setMaxBackups(10);
  }

  /**
   * Creates a production configuration optimized for performance
   * @returns Storage configuration builder
   */
  static production(): StorageConfigBuilder {
    return new StorageConfigBuilder()
      .setDefaultAdapter('cloud')
      .setValidateOnLoad(false) // Skip validation for performance
      .enableAutoSave(120000) // 2 minutes
      .setMaxBackups(5);
  }
}

/**
 * Environment-based configuration factory
 */
export class StorageConfigFactory {
  /**
   * Creates a configuration based on the current environment
   * @param environment Environment name (development, production, test)
   * @param customOptions Custom configuration options to merge
   * @returns Storage configuration
   */
  static createForEnvironment(
    environment: string,
    customOptions?: Partial<StorageConfig>
  ): StorageConfig {
    let builder: StorageConfigBuilder;

    switch (environment) {
      case 'development':
        builder = StorageConfigPresets.development();
        break;
      case 'production':
        builder = StorageConfigPresets.production();
        break;
      case 'test':
        builder = new StorageConfigBuilder()
          .setDefaultAdapter('memory') // In-memory for tests
          .disableAutoSave()
          .setValidateOnLoad(true)
          .setMaxBackups(1);
        break;
      default:
        builder = StorageConfigPresets.fileOnly();
    }

    const config = builder.build();

    // Merge custom options
    if (customOptions) {
      return {
        ...config,
        ...customOptions,
        options: {
          ...config.options,
          ...customOptions.options,
        },
        adapters: {
          ...config.adapters,
          ...customOptions.adapters,
        },
      };
    }

    return config;
  }

  /**
   * Creates a configuration from environment variables
   * @returns Storage configuration based on environment variables
   */
  static createFromEnv(): StorageConfig {
    const environment = process.env.NODE_ENV || 'development';
    const autoSave = process.env.STORAGE_AUTO_SAVE !== 'false';
    const autoSaveInterval = parseInt(process.env.STORAGE_AUTO_SAVE_INTERVAL || '30000');
    const maxBackups = parseInt(process.env.STORAGE_MAX_BACKUPS || '5');
    const validateOnLoad = process.env.STORAGE_VALIDATE_ON_LOAD !== 'false';
    const defaultAdapter = process.env.STORAGE_DEFAULT_ADAPTER || 'file';

    return StorageConfigFactory.createForEnvironment(environment, {
      defaultAdapter,
      options: {
        autoSave,
        autoSaveInterval,
        maxBackups,
        validateOnLoad,
      },
    });
  }
}

/**
 * Validation utilities for storage configurations
 */
export class StorageConfigValidator {
  /**
   * Validates a storage configuration
   * @param config Configuration to validate
   * @returns Array of validation errors (empty if valid)
   */
  static validate(config: StorageConfig): string[] {
    const errors: string[] = [];

    // Validate default adapter
    if (!config.defaultAdapter) {
      errors.push('Default adapter must be specified');
    } else if (!config.adapters[config.defaultAdapter]) {
      errors.push(`Default adapter '${config.defaultAdapter}' is not registered`);
    }

    // Validate adapters
    if (!config.adapters || Object.keys(config.adapters).length === 0) {
      errors.push('At least one adapter must be registered');
    }

    // Validate options
    if (config.options) {
      if (typeof config.options.autoSave !== 'boolean') {
        errors.push('autoSave option must be a boolean');
      }

      if (
        typeof config.options.autoSaveInterval !== 'number' ||
        config.options.autoSaveInterval < 1000
      ) {
        errors.push('autoSaveInterval must be a number >= 1000 (1 second)');
      }

      if (typeof config.options.maxBackups !== 'number' || config.options.maxBackups < 0) {
        errors.push('maxBackups must be a non-negative number');
      }

      if (typeof config.options.validateOnLoad !== 'boolean') {
        errors.push('validateOnLoad option must be a boolean');
      }
    }

    return errors;
  }

  /**
   * Throws an error if the configuration is invalid
   * @param config Configuration to validate
   * @throws Error if configuration is invalid
   */
  static validateOrThrow(config: StorageConfig): void {
    const errors = StorageConfigValidator.validate(config);
    if (errors.length > 0) {
      throw new Error(`Storage configuration is invalid:\n${errors.join('\n')}`);
    }
  }
}

/**
 * Creates a new storage configuration builder
 * @returns New StorageConfigBuilder instance
 */
export function createStorageConfig(): StorageConfigBuilder {
  return new StorageConfigBuilder();
}
