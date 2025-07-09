"use client";

import React, { useState } from "react";
import Compressor from "compressorjs";
import { useTranslations } from "next-intl";
import Image from "next/image";

interface CompressorFileInputProps {
  onFilesSelected: (compressedFiles: File[]) => void;
}

const CompressorFileInput: React.FC<CompressorFileInputProps> = ({
  onFilesSelected,
}) => {
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [compressedFiles, setCompressedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const t = useTranslations("report-found");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (!files || files.length === 0) return;

    setIsProcessing(true);

    try {
      const promises = Array.from(files).map((file) => {
        return new Promise<{ file: File; preview: string }>((resolve, reject) => {
          new Compressor(file, {
            quality: 0.6,
            maxWidth: 1024,
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
      // Clear the input to allow re-selecting the same files
      e.target.value = '';
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
    onFilesSelected([]);
  };

  return (
    <div>
      <label
        htmlFor="compressed-file-input"
        className="block text-lg font-semibold text-gray-700"
      >
        {t("uploadImages")}
      </label>
      
      <div className="mt-2">
        <input
          type="file"
          id="compressed-file-input"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          disabled={isProcessing}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-wait"
        />
        
        {isProcessing && (
          <div className="mt-2 text-sm text-blue-600 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Processing images...
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