"use client";

import React, { useState } from "react";
import Compressor from "compressorjs";
import { useTranslations } from "next-intl";
import Image from "next/image";
import imageUploadService from "@/services/imageUploadService";

interface CompressorFileInputProps {
  onFilesSelected: (compressedFiles: File[]) => void;
  maxFiles?: number;
  showValidation?: boolean;
  compressionQuality?: number;
  maxWidth?: number;
  maxHeight?: number;
  showOptimizationSettings?: boolean;
  translationNamespace?: "report-found" | "report-missing";
}

interface FileError {
  file: File;
  error: string;
}

const CompressorFileInput: React.FC<CompressorFileInputProps> = ({
  onFilesSelected,
  maxFiles = 10,
  showValidation = true,
  compressionQuality = 0.6,
  maxWidth = 1024,
  maxHeight = 1024,
  showOptimizationSettings = false,
  translationNamespace = "report-found"
}) => {
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [compressedFiles, setCompressedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileErrors, setFileErrors] = useState<FileError[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentQuality, setCurrentQuality] = useState(compressionQuality);
  const [currentMaxWidth, setCurrentMaxWidth] = useState(maxWidth);
  const [currentMaxHeight, setCurrentMaxHeight] = useState(maxHeight);

  const t = useTranslations(translationNamespace);

  // Process files - common function for both file input and drag-drop
  const processFiles = async (fileList: FileList) => {
    if (!fileList || fileList.length === 0) return;

    // Clear previous errors
    setFileErrors([]);
    setValidationErrors([]);

    const files = Array.from(fileList);

    // Check max files limit
    if (compressedFiles.length + files.length > maxFiles) {
      setValidationErrors([`Maximum ${maxFiles} files allowed. You can select ${maxFiles - compressedFiles.length} more files.`]);
      return;
    }

    setIsProcessing(true);

    try {
      const validFiles: File[] = [];
      const invalidFiles: FileError[] = [];

      // Validate files before processing
      files.forEach(file => {
        if (showValidation) {
          const validation = imageUploadService.validateFile(file);
          if (validation.isValid) {
            validFiles.push(file);
          } else {
            invalidFiles.push({ file, error: validation.error! });
          }
        } else {
          validFiles.push(file);
        }
      });

      // Show validation errors
      if (invalidFiles.length > 0) {
        setFileErrors(invalidFiles);
      }

      // Process valid files only
      if (validFiles.length === 0) {
        setIsProcessing(false);
        return;
      }
      const promises = validFiles.map((file) => {
        return new Promise<{ file: File; preview: string }>((resolve, reject) => {
          new Compressor(file, {
            quality: currentQuality,
            maxWidth: currentMaxWidth,
            maxHeight: currentMaxHeight,
            success: (compressedFile: File) => {
              const reader = new FileReader();
              reader.onload = () => {
                if (reader.result) {
                  resolve({
                    file: compressedFile,
                    preview: reader.result.toString()
                  });
                } else {
                  reject(new Error("Failed to read file"));
                }
              };
              reader.onerror = () => reject(new Error("FileReader error"));
              reader.readAsDataURL(compressedFile);
            },
            error: (err: any) => {
              console.error("Compression error:", err);
              reject(err);
            },
          });
        });
      });

      const results = await Promise.allSettled(promises);
      
      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<{ file: File; preview: string }> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value);

      if (successfulResults.length > 0) {
        const newFiles = successfulResults.map(result => result.file);
        const newPreviews = successfulResults.map(result => result.preview);
        
        const updatedFiles = [...compressedFiles, ...newFiles];
        const updatedPreviews = [...previewImages, ...newPreviews];
        
        setCompressedFiles(updatedFiles);
        setPreviewImages(updatedPreviews);
        onFilesSelected(updatedFiles);
      }

    } catch (error) {
      console.error("Error processing files:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file input change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(e.target.files);
      // Clear the input to allow re-selecting the same files
      e.target.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragOver to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const handleDeleteImage = (index: number) => {
    const updatedPreviewImages = previewImages.filter((_, i) => i !== index);
    const updatedCompressedFiles = compressedFiles.filter((_, i) => i !== index);

    setPreviewImages(updatedPreviewImages);
    setCompressedFiles(updatedCompressedFiles);
    onFilesSelected(updatedCompressedFiles);
  };

  const handleClearAll = () => {
    setPreviewImages([]);
    setCompressedFiles([]);
    setFileErrors([]);
    setValidationErrors([]);
    onFilesSelected([]);
  };

  return (
    <div>
      <label
        htmlFor="compressed-file-input"
        className="block text-base md:text-lg font-semibold text-gray-700"
      >
        {t("uploadImages")}
      </label>
      
      {/* Optimization Settings */}
      {showOptimizationSettings && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Image Optimization Settings</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Quality Setting */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Quality: {Math.round(currentQuality * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={currentQuality}
                onChange={(e) => setCurrentQuality(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>10%</span>
                <span>100%</span>
              </div>
            </div>
            
            {/* Max Width Setting */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Max Width: {currentMaxWidth}px
              </label>
              <input
                type="range"
                min="200"
                max="2000"
                step="50"
                value={currentMaxWidth}
                onChange={(e) => setCurrentMaxWidth(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>200px</span>
                <span>2000px</span>
              </div>
            </div>
            
            {/* Max Height Setting */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Max Height: {currentMaxHeight}px
              </label>
              <input
                type="range"
                min="200"
                max="2000"
                step="50"
                value={currentMaxHeight}
                onChange={(e) => setCurrentMaxHeight(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>200px</span>
                <span>2000px</span>
              </div>
            </div>
          </div>
          
          {/* Reset to defaults */}
          <button
            type="button"
            onClick={() => {
              setCurrentQuality(compressionQuality);
              setCurrentMaxWidth(maxWidth);
              setCurrentMaxHeight(maxHeight);
            }}
            className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Reset to defaults
          </button>
        </div>
      )}
      
      <div className="mt-4">
        {/* Drag and Drop Zone */}
        <div
          className={`relative w-full min-h-[120px] border-2 border-dashed rounded-lg transition-all duration-300 ${
            isDragOver 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center p-6 text-center min-h-[120px]">
            {isDragOver ? (
              <p className="text-base font-medium text-blue-600">
                {t("dropImagesHere")}
              </p>
            ) : (
              <p className="text-base font-medium text-gray-600">
                {t("dragDropPlaceholder")}
              </p>
            )}
          </div>
          
          {/* Hidden file input */}
          <input
            type="file"
            id="compressed-file-input"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            disabled={isProcessing}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
        </div>
        
        {isProcessing && (
          <div className="mt-2 text-sm text-blue-600 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Processing images...
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-800 font-medium mb-1">Upload Error:</div>
            {validationErrors.map((error, index) => (
              <div key={index} className="text-sm text-red-600">{error}</div>
            ))}
          </div>
        )}

        {/* File-specific Errors */}
        {fileErrors.length > 0 && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-800 font-medium mb-2">Some files could not be processed:</div>
            {fileErrors.map((fileError, index) => (
              <div key={index} className="text-sm text-red-600 mb-1">
                <span className="font-medium">{fileError.file.name}:</span> {fileError.error}
              </div>
            ))}
          </div>
        )}
      </div>

      {previewImages.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              {previewImages.length} image(s) selected
            </span>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Clear All
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {previewImages.map((src, index) => (
              <div key={index} className="relative w-24 h-24 overflow-hidden rounded-lg shadow-md border border-gray-200">
                <Image
                  src={src}
                  alt={`Preview ${index + 1}`}
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white text-sm rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                  aria-label={`Delete image ${index + 1}`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompressorFileInput;