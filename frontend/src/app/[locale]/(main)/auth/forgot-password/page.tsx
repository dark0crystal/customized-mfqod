'use client'

import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { authApi } from "@/utils/api"

export default function ForgotPassword() {
  const t = useTranslations("auth.forgotPasswordPage")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const forgotPasswordSchema = z.object({
    email: z.string().email(t("validation.emailRequired")),
  })

  type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await authApi.requestPasswordReset(data.email)

      if (response.error) {
        // Use translated message for internal user error (backend returns English)
        const isInternalUserError = response.error.toLowerCase().includes("internal users")
        setError(isInternalUserError ? t("internalUserError") : response.error)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"))
      console.error("Error during password reset request:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
      <h2 className="text-2xl font-bold text-center mb-6" style={{ color: '#3277AE' }}>{t("title")}</h2>
      <p className="text-gray-600 text-center mb-6">{t("subtitle")}</p>

      <p className="text-xs text-gray-500 mb-4 text-center">
        {t("internalUsersNotice")}
      </p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {t("successMessage")}
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">{t("emailLabel")}</label>
            <input
              type="email"
              {...register("email")}
              placeholder={t("emailPlaceholder")}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
              style={{
                '--tw-ring-color': '#3277AE',
                '--tw-ring-offset-color': '#3277AE'
              } as React.CSSProperties & { [key: string]: string }}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="mt-2 text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="text-center">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full p-3 text-white font-semibold rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#3277AE',
                '--tw-ring-color': '#3277AE'
              } as React.CSSProperties & { [key: string]: string }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = '#2a5f94';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = '#3277AE';
                }
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t("submitting")}
                </span>
              ) : (
                t("submitButton")
              )}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/auth/login"
          className="font-medium transition-colors"
          style={{ color: '#3277AE' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#2a5f94';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#3277AE';
          }}
        >
          {t("backToLogin")}
        </Link>
      </div>
    </div>
  )
}
