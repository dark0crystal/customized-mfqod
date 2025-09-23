"use client";

import React, { useState } from "react";
import Image from "next/image";
import { IoMdResize, IoMdClose, IoMdTrash } from "react-icons/io";
import { MdArrowBack, MdArrowForward } from "react-icons/md";

export interface ImageData {
  id: string;
  url: string;
  alt?: string;
  caption?: string;
}

interface ImageGalleryProps {
  images: ImageData[];
  onDelete?: (imageId: string) => void;
  showDeleteButton?: boolean;
  maxHeight?: string;
  className?: string;
  columns?: number;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  onDelete,
  showDeleteButton = false,
  maxHeight = "300px",
  className = "",
  columns = 3
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  if (!images || images.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">No images to display</p>
      </div>
    );
  }

  const handleImageClick = (index: number) => {
    setExpandedIndex(index);
  };

  const handleClose = () => {
    setExpandedIndex(null);
  };

  const handlePrevious = () => {
    if (expandedIndex !== null && expandedIndex > 0) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  const handleNext = () => {
    if (expandedIndex !== null && expandedIndex < images.length - 1) {
      setExpandedIndex(expandedIndex + 1);
    }
  };

  const handleDelete = async (imageId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!onDelete || isDeleting) return;
    
    if (window.confirm("Are you sure you want to delete this image?")) {
      setIsDeleting(imageId);
      try {
        await onDelete(imageId);
      } catch (error) {
        console.error("Failed to delete image:", error);
        alert("Failed to delete image. Please try again.");
      } finally {
        setIsDeleting(null);
      }
    }
  };

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (expandedIndex === null) return;
      
      switch (event.key) {
        case 'Escape':
          handleClose();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expandedIndex]);

  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (expandedIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [expandedIndex]);

  const getGridCols = () => {
    switch (columns) {
      case 1: return "grid-cols-1";
      case 2: return "grid-cols-2";
      case 3: return "grid-cols-3";
      case 4: return "grid-cols-4";
      default: return "grid-cols-3";
    }
  };

  return (
    <div className={`image-gallery ${className}`}>
      {/* Grid of Images */}
      <div className={`grid ${getGridCols()} gap-4`}>
        {images.map((image, index) => (
          <div
            key={image.id}
            className="relative group cursor-pointer overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-all duration-300 bg-gray-100"
            style={{ height: maxHeight }}
            onClick={() => handleImageClick(index)}
          >
            {/* Image */}
            <Image
              src={image.url}
              alt={image.alt || `Image ${index + 1}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />

            {/* Overlay with controls */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex space-x-2">
                {/* Expand Button */}
                <button
                  title="View full size"
                  className="p-2 bg-white text-gray-800 rounded-full hover:bg-gray-100 transition-colors shadow-lg"
                >
                  <IoMdResize className="w-5 h-5" />
                </button>

                {/* Delete Button */}
                {showDeleteButton && onDelete && (
                  <button
                    title="Delete image"
                    onClick={(e) => handleDelete(image.id, e)}
                    disabled={isDeleting === image.id}
                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg disabled:bg-red-300"
                  >
                    {isDeleting === image.id ? (
                      <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <IoMdTrash className="w-5 h-5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Image Caption */}
            {image.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <p className="text-white text-sm font-medium truncate">{image.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Expanded Image Modal */}
      {expandedIndex !== null && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div className="relative max-w-[95vw] max-h-[95vh] w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <button
              title="Close"
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            >
              <IoMdClose className="w-6 h-6" />
            </button>

            {/* Previous Button */}
            {expandedIndex > 0 && (
              <button
                title="Previous image"
                onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <MdArrowBack className="w-6 h-6" />
              </button>
            )}

            {/* Next Button */}
            {expandedIndex < images.length - 1 && (
              <button
                title="Next image"
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <MdArrowForward className="w-6 h-6" />
              </button>
            )}

            {/* Image Counter */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {expandedIndex + 1} / {images.length}
            </div>

            {/* Expanded Image */}
            <div 
              className="relative w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={images[expandedIndex].url}
                alt={images[expandedIndex].alt || `Image ${expandedIndex + 1}`}
                fill
                className="object-contain"
                sizes="95vw"
                priority
              />
            </div>

            {/* Image Info */}
            {images[expandedIndex].caption && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg max-w-md text-center">
                <p className="text-sm">{images[expandedIndex].caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGallery;