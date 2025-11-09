'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  AlertCircle
} from 'lucide-react'
import PasswordStrengthIndicator from '@/components/auth/PasswordStrengthIndicator'
import { authApi } from '@/utils/api'

export default function Register() {
  const t = useTranslations("auth.register")
  
  // Password validation schema - simplified to just require 8+ characters
  const passwordSchema = z.string()
    .min(8, t("validation.passwordMinLength"))

  // Registration form schema
  const signupSchema = z.object({
    email: z.string().email(t("validation.emailRequired")),
    password: passwordSchema,
    confirmPassword: z.string(),
    first_name: z.string()
      .min(1, t("validation.firstNameRequired"))
      .max(50, t("validation.firstNameMaxLength")),
    last_name: z.string()
      .min(1, t("validation.lastNameRequired"))
      .max(50, t("validation.lastNameMaxLength")),
    username: z.string()
      .min(3, t("validation.usernameMinLength"))
      .max(30, t("validation.usernameMaxLength"))
      .regex(/^[a-zA-Z0-9_.-]+$/, t("validation.usernameInvalidChars"))
      .optional()
      .or(z.literal('')),
    phone_number: z.string()
      .regex(/^\+?[\d\s\-\(\)]+$/, t("validation.phoneInvalid"))
      .optional()
      .or(z.literal(''))
  }).refine((data) => data.password === data.confirmPassword, {
    message: t("validation.passwordsDontMatch"),
    path: ["confirmPassword"],
  })

  type SignupFormData = z.infer<typeof signupSchema>
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setError
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange'
  })

  const password = watch('password')

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true)
    setApiError(null)
    setSuccessMessage(null)

    try {
      // Prepare the payload according to backend schema
      const payload = {
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        ...(data.username && { username: data.username }),
        ...(data.phone_number && { phone_number: data.phone_number })
      }

      const response = await authApi.register(payload)

      if (response.error) {
        // Handle validation errors
        if (response.validationErrors) {
          Object.entries(response.validationErrors).forEach(([field, message]) => {
            setError(field as keyof SignupFormData, { message })
          })
        }
        
        setApiError(response.error)
        return
      }

      // Success
      setSuccessMessage(t("accountCreated"))
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/auth/login')
      }, 2000)

    } catch (error) {
      console.error('Registration error:', error)
      setApiError(t("networkError"))
    } finally {
      setIsLoading(false)
    }
  }

  const getInputClassName = (fieldName: keyof SignupFormData) => {
    const baseClasses = "w-full p-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors"
    const hasError = errors[fieldName]
    
    return hasError
      ? `${baseClasses} border-red-500 focus:ring-red-500 bg-red-50`
      : `${baseClasses} border-gray-300`
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#3277AE' }}>{t("title")}</h1>
        <p className="text-gray-600 mt-2">{t("subtitle")}</p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 text-green-800 border border-green-200 flex items-center">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* API Error */}
      {apiError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-800 border border-red-200 flex items-center">
          <XCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">
            {t("email")} *
          </label>
          <input
            type="email"
            {...register('email')}
            className={getInputClassName('email')}
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
            placeholder={t("emailPlaceholder")}
            disabled={isLoading}
          />
          {errors.email && (
            <p className="mt-2 text-sm text-red-500 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* First Name */}
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">
              {t("firstName")} *
            </label>
            <input
              type="text"
              {...register('first_name')}
              className={getInputClassName('first_name')}
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
              placeholder={t("firstNamePlaceholder")}
              disabled={isLoading}
            />
            {errors.first_name && (
              <p className="mt-2 text-sm text-red-500 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.first_name.message}
              </p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">
              {t("lastName")} *
            </label>
            <input
              type="text"
              {...register('last_name')}
              className={getInputClassName('last_name')}
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
              placeholder={t("lastNamePlaceholder")}
              disabled={isLoading}
            />
            {errors.last_name && (
              <p className="mt-2 text-sm text-red-500 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.last_name.message}
              </p>
            )}
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">
            {t("username")}
          </label>
          <input
            type="text"
            {...register('username')}
            className={getInputClassName('username')}
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
            placeholder={t("usernamePlaceholder")}
            disabled={isLoading}
          />
          {errors.username && (
            <p className="mt-2 text-sm text-red-500 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.username.message}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Leave empty to use your email as username
          </p>
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">
            {t("phoneNumber")}
          </label>
          <input
            type="tel"
            {...register('phone_number')}
            className={getInputClassName('phone_number')}
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
            placeholder={t("phoneNumberPlaceholder")}
            disabled={isLoading}
          />
          {errors.phone_number && (
            <p className="mt-2 text-sm text-red-500 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.phone_number.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">
            {t("password")} *
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              {...register('password')}
              className={getInputClassName('password')}
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
              placeholder={t("passwordPlaceholder")}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              disabled={isLoading}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-2 text-sm text-red-500 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.password.message}
            </p>
          )}
          
          {/* Password Strength Indicator */}
          {password && (
            <PasswordStrengthIndicator password={password} className="mt-2" />
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">
            {t("confirmPassword")} *
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              {...register('confirmPassword')}
              className={getInputClassName('confirmPassword')}
            style={{ 
              '--tw-ring-color': '#3277AE',
              '--tw-ring-offset-color': '#3277AE'
            } as React.CSSProperties & { [key: string]: string }}
              placeholder={t("confirmPasswordPlaceholder")}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              disabled={isLoading}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-2 text-sm text-red-500 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
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
                {t("registering")}
              </span>
            ) : (
              t("registerButton")
            )}
          </button>
        </div>
      </form>

      {/* Footer */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          {t("alreadyHaveAccount")}{' '}
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
            {t("signIn")}
          </Link>
        </p>
      </div>

      {/* University Users Notice */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800 text-center">
          <strong>{t("universityUsersNotice")}</strong>
        </p>
      </div>
    </div>
  )
}