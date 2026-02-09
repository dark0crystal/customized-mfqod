import { getTranslations } from 'next-intl/server';

export default async function PrivacyTermsPage() {
  const t = await getTranslations('legal');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6" dir="auto">
          {t('title')}
        </h1>

        <p className="text-gray-700 mb-8 leading-relaxed" dir="auto">
          {t('intro')}
        </p>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3" dir="auto">
              {t('section1.title')}
            </h2>
            <ul className="list-decimal list-inside space-y-2 text-gray-700 leading-relaxed" dir="auto">
              <li>{t('section1.p1')}</li>
              <li>{t('section1.p2')}</li>
              <li>{t('section1.p3')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3" dir="auto">
              {t('section2.title')}
            </h2>
            <ul className="list-decimal list-inside space-y-2 text-gray-700 leading-relaxed" dir="auto">
              <li>{t('section2.p1')}</li>
              <li>{t('section2.p2')}</li>
              <li>{t('section2.p3')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3" dir="auto">
              {t('section3.title')}
            </h2>
            <ul className="list-decimal list-inside space-y-2 text-gray-700 leading-relaxed" dir="auto">
              <li>{t('section3.p1')}</li>
              <li>{t('section3.p2')}</li>
              <li>{t('section3.p3')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3" dir="auto">
              {t('section4.title')}
            </h2>
            <ul className="list-decimal list-inside space-y-2 text-gray-700 leading-relaxed" dir="auto">
              <li>{t('section4.p1')}</li>
              <li>{t('section4.p2')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3" dir="auto">
              {t('section5.title')}
            </h2>
            <ul className="list-decimal list-inside space-y-2 text-gray-700 leading-relaxed" dir="auto">
              <li>{t('section5.p1')}</li>
              <li>{t('section5.p2')}</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
