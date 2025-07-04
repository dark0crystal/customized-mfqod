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

  const t =useTranslations("report-found");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (!files) return;

    const newCompressedFiles: File[] = [];
    const imagePreviews: string[] = [];

    Array.from(files).forEach((file) => {
      // Compress each file using Compressor.js
      new Compressor(file, {
        quality: 0.6,
        maxWidth: 1024,
        success: (compressedFile: File) => {
          newCompressedFiles.push(compressedFile);

          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result) {
              imagePreviews.push(reader.result.toString());
            }

            // Update state only after all files are processed
            if (newCompressedFiles.length === files.length) {
              setCompressedFiles((prevFiles) => [...prevFiles, ...newCompressedFiles]);
              setPreviewImages((prevImages) => [...prevImages, ...imagePreviews]);
              onFilesSelected([...compressedFiles, ...newCompressedFiles]);
            }
          };
          reader.readAsDataURL(compressedFile);
        },
        error: (err: any) => console.error("Compression error:", err),
      });
    });
  };

  const handleDeleteImage = (index: number) => {
    const updatedPreviewImages = previewImages.filter((_, i) => i !== index);
    const updatedCompressedFiles = compressedFiles.filter((_, i) => i !== index);

    setPreviewImages(updatedPreviewImages);
    setCompressedFiles(updatedCompressedFiles);
    onFilesSelected(updatedCompressedFiles); // Update the parent component
  };

  return (
    <div>
      <label
        htmlFor="compressed-file-input"
        className="block text-lg font-semibold text-gray-700"
      >
        {t("uploadImages")}
      </label>
      <input
        type="file"
        id="compressed-file-input"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {previewImages.map((src, index) => (
          <div key={index} className="relative w-24 h-24 overflow-hidden ounded-lg shadow-md">
            <Image
              src={src}
              alt={`Preview ${index}`}
              objectFit="cover"
              fill
              className="absolute"
            />
            <button
              onClick={() => handleDeleteImage(index)}
              className="absolute top-1 right-1 bg-red-500 text-white text-sm rounded-full p-1 hover:bg-red-600"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompressorFileInput;