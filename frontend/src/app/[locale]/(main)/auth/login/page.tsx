'use client'

import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useAuth } from "@/hooks/useAuth"

export default function Login() {
  const t = useTranslations("auth.login")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login: authLogin, isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loginSchema = z.object({
    identifier: z.string().min(3, t("validation.usernameOrEmailRequired")),
    password: z.string().min(6, t("validation.passwordRequired")),
  })

  type LoginFormData = z.infer<typeof loginSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Check if user is already authenticated and redirect if so
  useEffect(() => {
    if (isAuthenticated) {
      // User is already logged in, redirect to returnUrl or main page
      const returnUrl = searchParams.get('returnUrl')
      const destination = returnUrl ? decodeURIComponent(returnUrl) : '/'
      router.push(destination)
    }
  }, [router, searchParams, isAuthenticated])

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Use the useAuth hook's login method to ensure state updates immediately
      await authLogin(data.identifier, data.password)
      
      setSuccess(t("loginSuccess"))
      console.log("Login success")
      
      // Redirect to returnUrl if provided, otherwise redirect to main page
      const returnUrl = searchParams.get('returnUrl')
      const destination = returnUrl ? decodeURIComponent(returnUrl) : '/'
      
      // Small delay to show success message and allow state to propagate
      setTimeout(() => {
        router.push(destination)
      }, 500)
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("loginFailed")
      setError(
        msg.toLowerCase().includes("invalid credentials")
          ? t("invalidCredentials")
          : msg
      )
      console.error("Error during login:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
      <h2 className="text-2xl font-bold text-center mb-6" style={{ color: '#3277AE' }}>{t("title")}</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">{t("usernameOrEmail")}</label>
          <p className="text-xs text-gray-500 mb-2">{t("externalUsersOnly")}</p>
          <input
            type="text"
            {...register("identifier")}
            placeholder={t("usernameOrEmailPlaceholder")}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
            disabled={isLoading}
          />
          {errors.identifier && (
            <p className="mt-2 text-sm text-red-500">{errors.identifier.message}</p>
          )}
        </div>

        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">{t("password")}</label>
          <input
            type="password"
            {...register("password")}
            placeholder={t("passwordPlaceholder")}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors"
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
            disabled={isLoading}
          />
          <div className="mt-2 text-end">
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium transition-colors"
              style={{ color: '#3277AE' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#2a5f94';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#3277AE';
              }}
            >
              {t("forgotPassword")}
            </Link>
          </div>
          {errors.password && (
            <p className="mt-2 text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        <p className="text-xs text-gray-500">
          {t.rich("termsNotice", {
            terms: (chunks) => (
              <Link href="/legal/terms" className="font-medium underline" style={{ color: '#3277AE' }}>
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/legal/privacy" className="font-medium underline" style={{ color: '#3277AE' }}>
                {chunks}
              </Link>
            ),
          })}
        </p>

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
                {t("loggingIn")}
              </span>
            ) : (
              t("loginButton")
            )}
          </button>
        </div>
      </form>

      {/* Sign up link */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          {t("noAccount")}{' '}
          <Link 
            href="/auth/register" 
            className="font-medium transition-colors"
            style={{ color: '#3277AE' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#2a5f94';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#3277AE';
            }}
          >
            {t("signUp")}
          </Link>
        </p>
      </div>
    </div>
  )
}