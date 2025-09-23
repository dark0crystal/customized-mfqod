"use client";

import React, { useState } from 'react';
import CompressorFileInput from './CompressorFileInput';
import ImageGallery, { ImageData } from '../ImageGallery';
import imageUploadService, { UploadProgress } from '@/services/imageUploadService';

/**
 * Test component to verify all image upload functionality
 * This component tests:
 * - Drag and drop upload
 * - File input upload
 * - Image optimization settings
 * - Progress tracking
 * - Error handling
 * - Image gallery display
 * - Delete functionality
 */
const ImageUploadTest: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadedImages, setUploadedImages] = useState<ImageData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [testItemId] = useState('test-item-' + Date.now());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setError(null);
    setSuccess(null);
    console.log('Files selected:', files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select files first');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(null);

    try {
      // Upload each file individually to test single upload functionality
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        console.log(`Uploading file ${i + 1}/${selectedFiles.length}:`, file.name);

        const response = await imageUploadService.uploadImageToItem(
          testItemId,
          file,
          (progress) => {
            setUploadProgress({
              ...progress,
              loaded: progress.loaded + (i * 1000000), // Simulate cumulative progress
              total: selectedFiles.length * 1000000
            });
          }
        );

        // Add to uploaded images gallery
        const newImage: ImageData = {
          id: response.data.id,
          url: response.data.url.startsWith('http') 
            ? response.data.url 
            : `${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}${response.data.url}`,
          alt: response.data.original_filename,
          caption: `${response.data.original_filename} (${Math.round(response.data.file_size / 1024)}KB)`
        };

        setUploadedImages(prev => [...prev, newImage]);
      }

      setSuccess(`Successfully uploaded ${selectedFiles.length} images!`);
      setSelectedFiles([]);
    } catch (error: any) {
      console.error('Upload failed:', error);
      setError(error.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await imageUploadService.deleteImage(imageId);
      setUploadedImages(prev => prev.filter(img => img.id !== imageId));
      setSuccess('Image deleted successfully');
    } catch (error: any) {
      console.error('Delete failed:', error);
      setError(error.message || 'Delete failed');
    }
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setUploadedImages([]);
    setError(null);
    setSuccess(null);
    setUploadProgress(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Image Upload System Test</h2>
      
      {/* Test Info */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Test Features:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>✅ Drag & Drop Support</li>
          <li>✅ File Input Support</li>
          <li>✅ Image Compression & Optimization</li>
          <li>✅ Progress Tracking</li>
          <li>✅ File Validation</li>
          <li>✅ Image Gallery with Modal View</li>
          <li>✅ Delete Functionality</li>
          <li>✅ Error Handling</li>
        </ul>
        <p className="text-xs text-blue-600 mt-2">Test Item ID: {testItemId}</p>
      </div>

      {/* File Input Section */}
      <div className="mb-6">
        <CompressorFileInput
          onFilesSelected={handleFilesSelected}
          maxFiles={10}
          showValidation={true}
          showOptimizationSettings={true}
          compressionQuality={0.8}
          maxWidth={1500}
          maxHeight={1500}
        />
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Selected Files ({selectedFiles.length}):
          </h3>
          <div className="space-y-1">
            {selectedFiles.map((file, index) => (
              <div key={index} className="text-sm text-gray-600 flex justify-between">
                <span>{file.name}</span>
                <span className="text-gray-500">
                  {Math.round(file.size / 1024)}KB - {file.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-blue-800">Uploading...</span>
            <span className="text-sm text-blue-600">{uploadProgress.percentage}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress.percentage}%` }}
            />
          </div>
          <div className="text-xs text-blue-600 mt-1">
            {Math.round(uploadProgress.loaded / 1024)}KB / {Math.round(uploadProgress.total / 1024)}KB
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm text-green-800">{success}</div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mb-6 flex space-x-4">
        <button
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || isUploading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} Files`}
        </button>
        
        <button
          onClick={handleClearAll}
          className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Uploaded Images Gallery */}
      {uploadedImages.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Uploaded Images ({uploadedImages.length})
          </h3>
          <ImageGallery
            images={uploadedImages}
            onDelete={handleDeleteImage}
            showDeleteButton={true}
            maxHeight="200px"
            columns={4}
            className="border border-gray-200 rounded-lg p-4"
          />
        </div>
      )}

      {/* Usage Instructions */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">How to Test:</h3>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>Try dragging and dropping image files onto the upload area</li>
          <li>Or click "browse" to select files using the file picker</li>
          <li>Adjust the optimization settings (quality, max width/height)</li>
          <li>Click "Upload Files" to test the upload process</li>
          <li>View uploaded images in the gallery below</li>
          <li>Click images to view in full-screen modal</li>
          <li>Test delete functionality using the trash icon</li>
        </ol>
      </div>
    </div>
  );
};

export default ImageUploadTest;