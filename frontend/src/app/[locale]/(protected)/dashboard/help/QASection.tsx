"use client";

import QAItem from './QAItem';

interface QAItemData {
  question: string;
  answer: string;
}

interface QASectionProps {
  title: string;
  items: QAItemData[];
}

export default function QASection({ title, items }: QASectionProps) {
  // If no items, don't render the section
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {title}
      </h3>
      <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
        {items.map((item, index) => (
          <QAItem
            key={index}
            question={item.question}
            answer={item.answer}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

