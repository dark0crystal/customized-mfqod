"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface CarouselImage {
  id?: string;
  url: string;
  alt?: string;
  description?: string;
}

interface ImageCarouselProps {
  images: CarouselImage[];
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  isModal?: boolean;
  onClose?: () => void;
  className?: string;
  showCounter?: boolean;
  showDots?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  currentIndex: controlledIndex,
  onIndexChange,
  isModal = false,
  onClose,
  className = '',
  showCounter = true,
  showDots = true,
  autoPlay = false,
  autoPlayInterval = 3000,
}) => {
  const [internalIndex, setInternalIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use controlled index if provided, otherwise use internal state
  const currentIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;

  const setIndex = useCallback((newIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(newIndex, images.length - 1));
    if (controlledIndex === undefined) {
      setInternalIndex(clampedIndex);
    }
    onIndexChange?.(clampedIndex);
  }, [controlledIndex, images.length, onIndexChange]);

  // Handle previous image
  const handlePrevious = useCallback(() => {
    if (images.length === 0) return;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    setIndex(newIndex);
  }, [currentIndex, images.length, setIndex]);

  // Handle next image
  const handleNext = useCallback(() => {
    if (images.length === 0) return;
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    setIndex(newIndex);
  }, [currentIndex, images.length, setIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isModal) {
        switch (event.key) {
          case 'Escape':
            onClose?.();
            break;
          case 'ArrowLeft':
            event.preventDefault();
            handlePrevious();
            break;
          case 'ArrowRight':
            event.preventDefault();
            handleNext();
            break;
        }
      }
    };

    if (isModal) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isModal, onClose, handlePrevious, handleNext]);

  // Handle touch events for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrevious();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  // Handle mouse drag for swipe
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setTranslateX(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const diff = currentX - startX;
    setTranslateX(diff);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    const minSwipeDistance = 50;
    if (Math.abs(translateX) > minSwipeDistance) {
      if (translateX > 0) {
        handlePrevious();
      } else {
        handleNext();
      }
    }
    
    setIsDragging(false);
    setTranslateX(0);
  };

  // Auto-play functionality
  useEffect(() => {
    if (autoPlay && images.length > 1 && !isModal) {
      autoPlayTimerRef.current = setInterval(() => {
        handleNext();
      }, autoPlayInterval);

      return () => {
        if (autoPlayTimerRef.current) {
          clearInterval(autoPlayTimerRef.current);
        }
      };
    }
  }, [autoPlay, autoPlayInterval, images.length, isModal, handleNext]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isModal) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isModal]);

  if (!images || images.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-200 rounded-lg ${className}`} style={{ minHeight: '300px' }}>
        <span className="text-gray-500 text-lg">مفقود</span>
        <span className="text-gray-400 text-sm mt-1">الصور غير متاحة</span>
      </div>
    );
  }

  const currentImage = images[currentIndex];
  const imageUrl = currentImage?.url || '';

  return (
    <div
      ref={carouselRef}
      className={`relative ${isModal ? 'w-full h-full' : 'w-full'} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Main Image Container */}
      <div
        className={`relative ${isModal ? 'w-full h-full' : 'w-full'} bg-black ${isModal ? '' : 'rounded-lg overflow-hidden'}`}
        style={{
          minHeight: isModal ? '100%' : '400px',
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-in-out',
        }}
      >
        <Image
          src={imageUrl}
          alt={currentImage?.alt || `Image ${currentIndex + 1}`}
          fill
          className="object-contain"
          sizes={isModal ? '100vw' : '100vw'}
          priority={currentIndex === 0}
          unoptimized={imageUrl.startsWith('http')}
        />
      </div>

      {/* Close Button (Modal only) */}
      {isModal && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
          aria-label="Close carousel"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      {/* Navigation Arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Image Counter */}
      {showCounter && images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Dot Indicators */}
      {showDots && images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white w-8'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Image Description (if available) */}
      {currentImage?.description && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 bg-black/70 text-white px-4 py-2 rounded-lg max-w-md text-center">
          <p className="text-sm">{currentImage.description}</p>
        </div>
      )}
    </div>
  );
};

export default ImageCarousel;



