import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import QASection from './QASection';

export default async function HelpPage() {
  const t = await getTranslations('dashboard.help');

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
          {t('section1.image', { defaultValue: '' }) && (
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
          <QASection sectionKey="section1" />
        </div>

        {/* Section 2 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            {t('section2.title')}
          </h2>
          <p className="text-gray-700 mb-4 whitespace-pre-line">
            {t('section2.description')}
          </p>
          {t('section2.image', { defaultValue: '' }) && (
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
          <QASection sectionKey="section2" />
        </div>

        {/* Section 3 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            {t('section3.title')}
          </h2>
          <p className="text-gray-700 mb-4 whitespace-pre-line">
            {t('section3.description')}
          </p>
          {t('section3.image', { defaultValue: '' }) && (
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
          <QASection sectionKey="section3" />
        </div>

        {/* Section 4 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            {t('section4.title')}
          </h2>
          <p className="text-gray-700 mb-4 whitespace-pre-line">
            {t('section4.description')}
          </p>
          {t('section4.image', { defaultValue: '' }) && (
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
          <QASection sectionKey="section4" />
        </div>
      </div>
    </div>
  );
}

