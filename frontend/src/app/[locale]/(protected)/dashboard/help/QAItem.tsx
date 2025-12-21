"use client";

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface QAItemProps {
  question: string;
  answer: string;
  index: number;
}

export default function QAItem({ question, answer, index }: QAItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Show answer on hover or click
  const showAnswer = isOpen || isHovered;

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
        aria-expanded={showAnswer}
        aria-controls={`answer-${index}`}
      >
        <span className="flex-1 font-medium text-gray-900 pr-4 rtl:pl-4 rtl:pr-0">
          {question}
        </span>
        <div className="flex-shrink-0">
          {showAnswer ? (
            <ChevronUp size={20} className="text-gray-600" />
          ) : (
            <ChevronDown size={20} className="text-gray-600" />
          )}
        </div>
      </button>
      <div
        id={`answer-${index}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showAnswer ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 pt-0 text-gray-700 whitespace-pre-line">
          {answer}
        </div>
      </div>
    </div>
  );
}

