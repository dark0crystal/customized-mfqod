"use client";

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale } from 'next-intl';
import { getDirectionClasses } from '@/utils/direction';

interface QAItemProps {
  question: string;
  answer: string;
  index: number;
}

export default function QAItem({ question, answer, index }: QAItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useLocale() as 'en' | 'ar';
  const directionClasses = getDirectionClasses(locale === 'ar' ? 'rtl' : 'ltr');

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 ${directionClasses.textAlign} hover:bg-gray-50 transition-colors duration-200 cursor-pointer`}
        aria-expanded={isOpen}
        aria-controls={`answer-${index}`}
      >
        <span className={`flex-1 font-medium text-gray-900 ${locale === 'ar' ? 'pl-4 pr-0' : 'pr-4 pl-0'}`}>
          {question}
        </span>
        <div className="flex-shrink-0">
          {isOpen ? (
            <ChevronUp size={20} className="text-gray-600" />
          ) : (
            <ChevronDown size={20} className="text-gray-600" />
          )}
        </div>
      </button>
      <div
        id={`answer-${index}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className={`p-4 pt-0 text-gray-700 whitespace-pre-line ${directionClasses.textAlign}`}>
          {answer}
        </div>
      </div>
    </div>
  );
}

