import { getTranslations } from "next-intl/server";

export default async function Loading() {

    const t = await getTranslations("loading")
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-solid rounded-full animate-spin border-t-transparent"></div>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-gray-700">{t("loadingMessage")}</h1>
      </div>
    );
  }
  