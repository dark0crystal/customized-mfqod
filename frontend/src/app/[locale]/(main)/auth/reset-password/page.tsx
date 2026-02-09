'use client'

import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Eye, EyeOff } from "lucide-react"
import PasswordStrengthIndicator from "@/components/auth/PasswordStrengthIndicator"
import { authApi } from "@/utils/api"

function ResetPasswordForm() {
  const t = useTranslations("auth.resetPasswordPage")
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const passwordSchema = z.string()
    .min(8, t("validation.passwordMinLength"))

  const resetPasswordSchema = z.object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t("validation.passwordsDontMatch"),
    path: ["confirmPassword"],
  })

  type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const password = watch("newPassword")

  useEffect(() => {
    if (!token) {
      setError(t("missingToken"))
    }
  }, [token, t])

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await authApi.confirmPasswordReset(token, data.newPassword)

      if (response.error) {
        setError(response.error)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/auth/login")
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("resetFailed"))
      console.error("Error during password reset:", err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
        <h2 className="text-2xl font-bold text-center mb-6" style={{ color: '#3277AE' }}>{t("title")}</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {t("missingToken")}
        </div>
        <div className="text-center">
          <Link
            href="/auth/forgot-password"
            className="font-medium transition-colors"
            style={{ color: '#3277AE' }}
          >
            {t("requestNewLink")}
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
        <h2 className="text-2xl font-bold text-center mb-6" style={{ color: '#3277AE' }}>{t("title")}</h2>
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {t("successMessage")}
        </div>
        <p className="text-center text-gray-600">{t("redirecting")}</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
      <h2 className="text-2xl font-bold text-center mb-6" style={{ color: '#3277AE' }}>{t("title")}</h2>
      <p className="text-gray-600 text-center mb-6">{t("subtitle")}</p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">{t("newPasswordLabel")}</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              {...register("newPassword")}
              placeholder={t("newPasswordPlaceholder")}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors pr-12"
              style={{
                '--tw-ring-color': '#3277AE',
                '--tw-ring-offset-color': '#3277AE'
              } as React.CSSProperties & { [key: string]: string }}
              disabled={isLoading}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.newPassword && (
            <p className="mt-2 text-sm text-red-500">{errors.newPassword.message}</p>
          )}
          {password && (
            <PasswordStrengthIndicator password={password} className="mt-2" />
          )}
        </div>

        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">{t("confirmPasswordLabel")}</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              {...register("confirmPassword")}
              placeholder={t("confirmPasswordPlaceholder")}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors pr-12"
              style={{
                '--tw-ring-color': '#3277AE',
                '--tw-ring-offset-color': '#3277AE'
              } as React.CSSProperties & { [key: string]: string }}
              disabled={isLoading}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-2 text-sm text-red-500">{errors.confirmPassword.message}</p>
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

      <div className="mt-6 text-center">
        <Link
          href="/auth/forgot-password"
          className="font-medium transition-colors"
          style={{ color: '#3277AE' }}
        >
          {t("requestNewLink")}
        </Link>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
        <div className="animate-pulse h-8 bg-gray-200 rounded mb-4"></div>
        <div className="animate-pulse h-4 bg-gray-200 rounded mb-2"></div>
        <div className="animate-pulse h-4 bg-gray-200 rounded"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
