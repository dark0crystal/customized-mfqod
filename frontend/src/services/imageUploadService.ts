/**
 * Unified Image Upload Service
 * Handles all image upload operations with proper authentication, error handling, and progress tracking
 */

export interface UploadError {
  error: string;
  message: string;
  details?: Record<string, any>;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    id: string;
    url: string;
    imageable_type: string;
    imageable_id: string;
    filename: string;
    original_filename: string;
    file_size: number;
    detected_format: string;
  };
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export class ImageUploadService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';
  }

  /**
   * Get authentication headers from tokenManager
   */
  private getAuthHeaders(): HeadersInit {
    if (typeof window === 'undefined') return {};
    
    // Try to import tokenManager dynamically
    let token: string | null = null;
    try {
      const { tokenManager } = require('@/utils/tokenManager');
      token = tokenManager.getAccessToken();
    } catch {
      // Fallback to cookie parsing if tokenManager is not available
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'token' || name === 'access_token' || name === 'auth_token') {
          token = decodeURIComponent(value);
          break;
        }
      }
    }

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  /**
   * Upload a single image to an item
   */
  async uploadImageToItem(
    itemId: string, 
    file: File,
    onProgress?: (progress: UploadProgress) => void,
    maxRetries: number = 2
  ): Promise<UploadResponse> {
    return this.retryUpload(
      () => this.performSingleUpload(itemId, file, onProgress),
      maxRetries
    );
  }

  /**
   * Perform a single upload attempt
   */
  private performSingleUpload(
    itemId: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // Set up progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress: UploadProgress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100)
            };
            onProgress(progress);
          }
        });
      }

      // Set up response handling
      xhr.addEventListener('load', () => {
        try {
          const response = JSON.parse(xhr.responseText);
          
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(response);
          } else {
            reject(this.parseError(response));
          }
        } catch {
          reject({
            error: 'PARSE_ERROR',
            message: 'Failed to parse server response',
            details: { status: xhr.status, responseText: xhr.responseText }
          });
        }
      });

      xhr.addEventListener('error', () => {
        reject({
          error: 'NETWORK_ERROR',
          message: 'Network error occurred during upload',
          details: { status: xhr.status }
        });
      });

      xhr.addEventListener('timeout', () => {
        reject({
          error: 'TIMEOUT_ERROR',
          message: 'Upload timed out',
          details: { timeout: xhr.timeout }
        });
      });

      // Configure request
      xhr.open('POST', `${this.baseUrl}/api/images/items/${itemId}/upload-image/`);
      xhr.timeout = 60000; // 60 seconds timeout
      
      // Set auth headers
      const authHeaders = this.getAuthHeaders();
      Object.entries(authHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Send request
      xhr.send(formData);
    });
  }

  /**
   * Retry upload logic with exponential backoff
   */
  private async retryUpload<T>(
    uploadFunction: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await uploadFunction();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on authentication or validation errors
        if (error.error === 'INVALID_FILE' || error.error === 'AUTH_ERROR') {
          throw error;
        }
        
        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, ...
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(
    imageableType: string,
    imageableId: string,
    files: File[],
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ message: string; images: any[] }> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('imageable_type', imageableType);
      formData.append('imageable_id', imageableId);
      
      files.forEach(file => {
        formData.append('files', file);
      });

      const xhr = new XMLHttpRequest();

      // Set up progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress: UploadProgress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100)
            };
            onProgress(progress);
          }
        });
      }

      // Set up response handling
      xhr.addEventListener('load', () => {
        try {
          const response = JSON.parse(xhr.responseText);
          
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(response);
          } else {
            reject(this.parseError(response));
          }
        } catch {
          reject({
            error: 'PARSE_ERROR',
            message: 'Failed to parse server response',
            details: { status: xhr.status, responseText: xhr.responseText }
          });
        }
      });

      xhr.addEventListener('error', () => {
        reject({
          error: 'NETWORK_ERROR',
          message: 'Network error occurred during upload'
        });
      });

      // Configure request
      xhr.open('POST', `${this.baseUrl}/api/images/upload-multiple-images/`);
      xhr.timeout = 120000; // 2 minutes for multiple files
      
      // Set auth headers
      const authHeaders = this.getAuthHeaders();
      Object.entries(authHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Send request
      xhr.send(formData);
    });
  }

  /**
   * Delete an image
   */
  async deleteImage(imageId: string): Promise<{ message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/images/${imageId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw this.parseError(data);
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw {
          error: 'DELETE_ERROR',
          message: error.message
        };
      }
      throw error;
    }
  }

  /**
   * Get images for an item
   */
  async getItemImages(itemId: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/images/items/${itemId}/images/`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw this.parseError(data);
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw {
          error: 'FETCH_ERROR',
          message: error.message
        };
      }
      throw error;
    }
  }

  /**
   * Generic upload image method for any entity type
   */
  async uploadImage(
    file: File,
    entityType: string,
    entityId: string,
    onProgress?: (progress: UploadProgress) => void,
    maxRetries: number = 2
  ): Promise<UploadResponse> {
    return this.retryUpload(
      () => this.performGenericUpload(file, entityType, entityId, onProgress),
      maxRetries
    );
  }

  /**
   * Perform a generic upload to any entity type
   */
  private performGenericUpload(
    file: File,
    entityType: string,
    entityId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // Set up progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress: UploadProgress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100)
            };
            onProgress(progress);
          }
        });
      }

      // Set up response handling
      xhr.addEventListener('load', () => {
        try {
          const response = JSON.parse(xhr.responseText);
          
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(response);
          } else {
            reject(this.parseError(response));
          }
        } catch {
          reject({
            error: 'PARSE_ERROR',
            message: 'Failed to parse server response',
            details: { status: xhr.status, responseText: xhr.responseText }
          });
        }
      });

      xhr.addEventListener('error', () => {
        reject({
          error: 'NETWORK_ERROR',
          message: 'Network error occurred during upload',
          details: { status: xhr.status }
        });
      });

      xhr.addEventListener('timeout', () => {
        reject({
          error: 'TIMEOUT_ERROR',
          message: 'Upload timed out',
          details: { timeout: xhr.timeout }
        });
      });

      // Configure request based on entity type
      let url: string;
      if (entityType === 'item') {
        url = `${this.baseUrl}/api/images/items/${entityId}/upload-image/`;
      } else if (entityType === 'claim') {
        url = `${this.baseUrl}/api/claims/${entityId}/upload-image/`;
      } else {
        reject({
          error: 'INVALID_ENTITY_TYPE',
          message: `Unsupported entity type: ${entityType}`,
          details: { entityType, entityId }
        });
        return;
      }

      xhr.open('POST', url);
      xhr.timeout = 60000; // 60 seconds timeout
      
      // Set auth headers
      const authHeaders = this.getAuthHeaders();
      Object.entries(authHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Send request
      xhr.send(formData);
    });
  }

  /**
   * Parse error response from server
   */
  private parseError(response: any): UploadError {
    if (typeof response === 'string') {
      return {
        error: 'SERVER_ERROR',
        message: response
      };
    }

    if (response.detail) {
      // FastAPI error format
      if (typeof response.detail === 'object') {
        return {
          error: response.detail.error || 'SERVER_ERROR',
          message: response.detail.message || 'An error occurred',
          details: response.detail.details
        };
      } else {
        return {
          error: 'SERVER_ERROR',
          message: response.detail
        };
      }
    }

    return {
      error: response.error || 'UNKNOWN_ERROR',
      message: response.message || 'An unknown error occurred',
      details: response.details
    };
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): { isValid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `Unsupported file type: ${file.type}. Supported types: JPG, PNG, GIF, BMP, WEBP`
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File too large: ${Math.round(file.size / 1024 / 1024)}MB. Maximum size: 10MB`
      };
    }

    if (file.size === 0) {
      return {
        isValid: false,
        error: 'Empty file'
      };
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const imageUploadService = new ImageUploadService();
export default imageUploadService;