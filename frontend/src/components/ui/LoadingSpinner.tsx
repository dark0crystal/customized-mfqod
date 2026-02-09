"use client";

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export default function LoadingSpinner({ 
  size = 'md', 
  message, 
  className = '' 
}: LoadingSpinnerProps) {
  const t = useTranslations('dashboard.sideNavbar');
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const defaultMessage = message || t('loadingDashboard');

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className={`${sizeClasses[size]} animate-spin text-indigo-500`} />
        {defaultMessage && (
          <p className="text-gray-500 text-sm">{defaultMessage}</p>
        )}
      </div>
    </div>
  );
}
