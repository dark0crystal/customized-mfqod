"use client";

import React, { useEffect, useRef, useState } from 'react';
import { X, Lightbulb, ChevronRight, ChevronLeft } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

export interface TourStep {
  id: string;
  target?: string; // CSS selector or data attribute
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  steps: TourStep[];
  translationKey: string; // e.g., "dashboard.items.tour"
}

export default function OnboardingTour({
  isOpen,
  onClose,
  steps,
  translationKey,
}: OnboardingTourProps) {
  const locale = useLocale();
  const t = useTranslations(translationKey);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const [overlayClipPath, setOverlayClipPath] = useState<string | undefined>(undefined);
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isRTL = locale === 'ar';
  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // Calculate position for modal based on target element
  useEffect(() => {
    if (!isOpen || !currentStepData?.target) {
      setHighlightedElement(null);
      setHighlightStyle({});
      setOverlayClipPath(undefined);
      return;
    }

    const updateHighlight = () => {
      const targetElement = document.querySelector(currentStepData.target!) as HTMLElement;
      if (!targetElement) {
        setHighlightedElement(null);
        setHighlightStyle({});
        setOverlayClipPath(undefined);
        return;
      }

      setHighlightedElement(targetElement);

      const rect = targetElement.getBoundingClientRect();
      const top = rect.top - 4;
      const left = rect.left - 4;
      const right = rect.right + 4;
      const bottom = rect.bottom + 4;

      setHighlightStyle({
        top: top,
        left: left,
        width: rect.width + 8,
        height: rect.height + 8,
      });

      // Update clip-path for overlay cutout
      setOverlayClipPath(`polygon(
        0% 0%,
        0% 100%,
        ${left}px 100%,
        ${left}px ${top}px,
        ${right}px ${top}px,
        ${right}px ${bottom}px,
        ${left}px ${bottom}px,
        ${left}px 100%,
        100% 100%,
        100% 0%
      )`);
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      updateHighlight();
      // Scroll target into view
      const targetElement = document.querySelector(currentStepData.target!) as HTMLElement;
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
        // Update again after scroll
        setTimeout(updateHighlight, 500);
      }
    }, 100);

    // Update on scroll and resize
    window.addEventListener('scroll', updateHighlight, true);
    window.addEventListener('resize', updateHighlight);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', updateHighlight, true);
      window.removeEventListener('resize', updateHighlight);
    };
  }, [isOpen, currentStep, currentStepData]);

  // Reset to first step when tour opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  // Prevent body scroll when tour is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDotClick = (index: number) => {
    setCurrentStep(index);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Safety check - if no step data, don't render
  if (!currentStepData) {
    return null;
  }

  // Check if modal overlaps with highlighted element
  const checkOverlap = (
    modalTop: number,
    modalLeft: number,
    modalWidth: number,
    modalHeight: number,
    elementRect: DOMRect
  ): boolean => {
    const modalRight = modalLeft + modalWidth;
    const modalBottom = modalTop + modalHeight;

    return !(
      modalRight < elementRect.left ||
      modalLeft > elementRect.right ||
      modalBottom < elementRect.top ||
      modalTop > elementRect.bottom
    );
  };

  // Get actual modal bounds from position and transform
  const getModalBounds = (
    top: number | string,
    left: number | string,
    transform: string,
    modalWidth: number,
    modalHeight: number
  ): { top: number; left: number; right: number; bottom: number } => {
    let actualTop = typeof top === 'string' ? parseFloat(top) : top;
    let actualLeft = typeof left === 'string' ? parseFloat(left) : left;

    if (transform.includes('translate(-50%')) {
      actualLeft -= modalWidth / 2;
    } else if (transform.includes('translate(-100%')) {
      actualLeft -= modalWidth;
    }

    if (transform.includes('translateY(-50%') || transform.includes('translate(-50%, -50%')) {
      actualTop -= modalHeight / 2;
    } else if (transform.includes('translateY(-100%') || transform.includes('translate(-50%, -100%')) {
      actualTop -= modalHeight;
    }

    return {
      top: actualTop,
      left: actualLeft,
      right: actualLeft + modalWidth,
      bottom: actualTop + modalHeight,
    };
  };

  // Calculate modal position based on target element, ensuring it stays within viewport and doesn't cover content
  const getModalPosition = () => {
    const modalHeight = 400;
    const modalWidth = 400;
    const spacing = 20;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const padding = 16;

    // Default center position
    let top: string | number = '50%';
    let left: string | number = '50%';
    let transform = 'translate(-50%, -50%)';

    if (!highlightedElement || !currentStepData.position) {
      return { top, left, transform };
    }

    const rect = highlightedElement.getBoundingClientRect();
    const preferredPosition = currentStepData.position;

    // Try preferred position first
    let candidateTop = 0;
    let candidateLeft = 0;
    let candidateTransform = '';

    switch (preferredPosition) {
      case 'top':
        candidateTop = rect.top - modalHeight - spacing;
        candidateLeft = rect.left + rect.width / 2;
        candidateTransform = 'translate(-50%, -100%)';
        break;
      case 'bottom':
        candidateTop = rect.bottom + spacing;
        candidateLeft = rect.left + rect.width / 2;
        candidateTransform = 'translate(-50%, 0)';
        break;
      case 'left':
        candidateTop = rect.top + rect.height / 2;
        candidateLeft = rect.left - modalWidth - spacing;
        candidateTransform = 'translate(-100%, -50%)';
        break;
      case 'right':
        candidateTop = rect.top + rect.height / 2;
        candidateLeft = rect.right + spacing;
        candidateTransform = 'translate(0, -50%)';
        break;
      default:
        top = '50%';
        left = '50%';
        transform = 'translate(-50%, -50%)';
        return { top, left, transform };
    }

    // Get actual bounds for candidate position
    const candidateBounds = getModalBounds(candidateTop, candidateLeft, candidateTransform, modalWidth, modalHeight);

    // Check if candidate position is valid (within viewport and no overlap)
    const withinViewport =
      candidateBounds.top >= padding &&
      candidateBounds.bottom <= viewportHeight - padding &&
      candidateBounds.left >= padding &&
      candidateBounds.right <= viewportWidth - padding;

    const noOverlap = !checkOverlap(
      candidateBounds.top,
      candidateBounds.left,
      modalWidth,
      modalHeight,
      rect
    );

    if (withinViewport && noOverlap) {
      top = candidateTop;
      left = candidateLeft;
      transform = candidateTransform;
    } else {
      // Try alternative positions
      const alternatives: Array<{ top: number; left: number; transform: string }> = [];

      if (preferredPosition === 'top' || preferredPosition === 'bottom') {
        // Try left and right
        alternatives.push(
          { top: rect.top + rect.height / 2, left: rect.left - modalWidth - spacing, transform: 'translate(-100%, -50%)' },
          { top: rect.top + rect.height / 2, left: rect.right + spacing, transform: 'translate(0, -50%)' }
        );
      } else {
        // Try top and bottom
        alternatives.push(
          { top: rect.top - modalHeight - spacing, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' },
          { top: rect.bottom + spacing, left: rect.left + rect.width / 2, transform: 'translate(-50%, 0)' }
        );
      }

      // Try center as last resort
      alternatives.push({
        top: viewportHeight / 2,
        left: viewportWidth / 2,
        transform: 'translate(-50%, -50%)',
      });

      // Find first valid alternative
      for (const alt of alternatives) {
        const altBounds = getModalBounds(alt.top, alt.left, alt.transform, modalWidth, modalHeight);
        const altWithinViewport =
          altBounds.top >= padding &&
          altBounds.bottom <= viewportHeight - padding &&
          altBounds.left >= padding &&
          altBounds.right <= viewportWidth - padding;
        const altNoOverlap = !checkOverlap(altBounds.top, altBounds.left, modalWidth, modalHeight, rect);

        if (altWithinViewport && altNoOverlap) {
          top = alt.top;
          left = alt.left;
          transform = alt.transform;
          break;
        }
      }
    }

    // Final clamp to ensure it's within viewport (even if it overlaps)
    const finalBounds = getModalBounds(top, left, transform, modalWidth, modalHeight);
    if (finalBounds.top < padding || finalBounds.bottom > viewportHeight - padding ||
        finalBounds.left < padding || finalBounds.right > viewportWidth - padding) {
      top = '50%';
      left = '50%';
      transform = 'translate(-50%, -50%)';
    }

    return { top, left, transform };
  };

  const modalStyle = getModalPosition();


  return (
    <>
      {/* Overlay with cutout for highlighted element */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[9998] transition-all duration-300"
        onClick={handleOverlayClick}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.10)',
          clipPath: overlayClipPath,
        }}
      />

      {/* Highlight border for target element */}
      {highlightedElement && Object.keys(highlightStyle).length > 0 && (
        <div
          className="fixed z-[9999] pointer-events-none border-4 border-[#3277AE] rounded-lg transition-all duration-300"
          style={highlightStyle}
        />
      )}

      {/* Modal */}
      <div
        ref={modalRef}
        className={`fixed z-[10000] bg-white rounded-xl shadow-2xl max-w-md w-[90%] sm:w-[400px] transition-all duration-300 ${
          isRTL ? 'text-right' : 'text-left'
        }`}
        style={modalStyle}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Lightbulb className="h-5 w-5 text-[#3277AE]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {(() => {
                  // Try to get translation, but prefer the prop value if translation key is returned
                  try {
                    const translationKey = `steps.${currentStepData.id}.title`;
                    const translated = t(translationKey);
                    // If next-intl returns the key (translation not found), use the prop value
                    // Also check if it's a valid translation (not the full path)
                    if (translated && !translated.includes('dashboard.') && translated !== translationKey) {
                      return translated;
                    }
                  } catch {
                    // Translation failed, use prop value
                  }
                  // Use the prop value (already translated in the parent component)
                  return currentStepData.title;
                })()}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t('stepIndicator', { current: currentStep + 1, total: steps.length })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('close')}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 leading-relaxed">
            {(() => {
              // Try to get translation, but prefer the prop value if translation key is returned
              try {
                const translationKey = `steps.${currentStepData.id}.description`;
                const translated = t(translationKey);
                // If next-intl returns the key (translation not found), use the prop value
                // Also check if it's a valid translation (not the full path)
                if (translated && !translated.includes('dashboard.') && translated !== translationKey) {
                  return translated;
                }
              } catch {
                // Translation failed, use prop value
              }
              // Use the prop value (already translated in the parent component)
              return currentStepData.description;
            })()}
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          {/* Navigation Dots */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  index === currentStep
                    ? 'w-8 bg-[#3277AE]'
                    : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={t('goToStep', { step: index + 1 })}
              />
            ))}
            {steps.length > 5 && (
              <span className="text-xs text-gray-500 ml-2">
                +{steps.length - 5}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                className={`flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ${
                  isRTL ? 'flex-row-reverse' : ''
                }`}
              >
                {isRTL ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
                <span>{t('previous')}</span>
              </button>
            )}
            <button
              onClick={handleNext}
              className={`flex items-center gap-2 px-6 py-2 bg-[#3277AE] text-white rounded-lg hover:bg-[#2a5f94] transition-colors font-semibold ml-auto ${
                isRTL ? 'flex-row-reverse ml-0 mr-auto' : ''
              }`}
            >
              <span>{isLastStep ? t('finish') : t('next')}</span>
              {isRTL ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

