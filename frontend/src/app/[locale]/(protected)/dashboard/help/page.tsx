import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import QASection from './QASection';

interface QAItem {
  question: string;
  answer: string;
}

export default async function HelpPage() {
  const t = await getTranslations('dashboard.help');

  // Helper function to get Q&A items for a section
  const getQAItems = (sectionKey: string): QAItem[] => {
    try {
      const items = t.raw(`${sectionKey}.qa.items`);
      if (Array.isArray(items)) {
        return items as QAItem[];
      }
    } catch {
      // If translation key doesn't exist, return empty array
      return [];
    }
    return [];
  };

  // Helper function to get Q&A title for a section
  const getQATitle = (sectionKey: string): string => {
    return t(`${sectionKey}.qa.title`) || 'Frequently Asked Questions';
  };

  return (
    <div className="space-y-6 px-2 sm:px-4 lg:px-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {t('title')}
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          {t('subtitle')}
        </p>
      </div>

      {/* Guide Sections */}
      <div className="space-y-6">
        {/* Section 1 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            {t('section1.title')}
          </h2>
          <p className="text-gray-700 mb-4 whitespace-pre-line">
            {t('section1.description')}
          </p>
          {t('section1.image') && (
            <div className="relative w-full h-64 sm:h-96 rounded-lg overflow-hidden bg-gray-100 mb-6">
              <Image
                src={t('section1.image')}
                alt={t('section1.imageAlt')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
              />
            </div>
          )}
          <QASection title={getQATitle('section1')} items={getQAItems('section1')} />
        </div>

        {/* Section 2 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            {t('section2.title')}
          </h2>
          <p className="text-gray-700 mb-4 whitespace-pre-line">
            {t('section2.description')}
          </p>
          {t('section2.image') && (
            <div className="relative w-full h-64 sm:h-96 rounded-lg overflow-hidden bg-gray-100 mb-6">
              <Image
                src={t('section2.image')}
                alt={t('section2.imageAlt')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
              />
            </div>
          )}
          <QASection title={getQATitle('section2')} items={getQAItems('section2')} />
        </div>

        {/* Section 3 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            {t('section3.title')}
          </h2>
          <p className="text-gray-700 mb-4 whitespace-pre-line">
            {t('section3.description')}
          </p>
          {t('section3.image') && (
            <div className="relative w-full h-64 sm:h-96 rounded-lg overflow-hidden bg-gray-100 mb-6">
              <Image
                src={t('section3.image')}
                alt={t('section3.imageAlt')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
              />
            </div>
          )}
          <QASection title={getQATitle('section3')} items={getQAItems('section3')} />
        </div>

        {/* Section 4 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            {t('section4.title')}
          </h2>
          <p className="text-gray-700 mb-4 whitespace-pre-line">
            {t('section4.description')}
          </p>
          {t('section4.image') && (
            <div className="relative w-full h-64 sm:h-96 rounded-lg overflow-hidden bg-gray-100 mb-6">
              <Image
                src={t('section4.image')}
                alt={t('section4.imageAlt')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
              />
            </div>
          )}
          <QASection title={getQATitle('section4')} items={getQAItems('section4')} />
        </div>
      </div>
    </div>
  );
}

