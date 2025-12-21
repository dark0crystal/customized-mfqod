"use client";

import { useTranslations } from 'next-intl';
import QAItem from './QAItem';

interface QASectionProps {
  sectionKey: string;
}

export default function QASection({ sectionKey }: QASectionProps) {
  const t = useTranslations(`dashboard.help.${sectionKey}.qa`);

  // Get all Q&A pairs - we'll check for q1, q2, etc.
  const qaPairs: Array<{ question: string; answer: string }> = [];
  let index = 1;

  while (true) {
    const questionKey = `q${index}`;
    const answerKey = `a${index}`;
    
    try {
      const question = t(questionKey, { defaultValue: '' });
      const answer = t(answerKey, { defaultValue: '' });
      
      if (!question && !answer) {
        break; // No more Q&A pairs
      }
      
      if (question && answer) {
        qaPairs.push({ question, answer });
      }
      
      index++;
    } catch {
      break; // Translation key doesn't exist
    }
  }

  if (qaPairs.length === 0) {
    return null; // No Q&A for this section
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {t('title', { defaultValue: 'Frequently Asked Questions' })}
      </h3>
      <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
        {qaPairs.map((qa, index) => (
          <QAItem
            key={index}
            question={qa.question}
            answer={qa.answer}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

