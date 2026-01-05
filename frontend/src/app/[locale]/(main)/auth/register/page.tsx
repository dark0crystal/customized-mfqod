'use client'

import { useState, useEffect } from 'react'
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
  const [showOtpStep, setShowOtpStep] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [formData, setFormData] = useState<SignupFormData | null>(null)
  const router = useRouter()

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendTimer])

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
    setIsSendingOtp(true)
    setApiError(null)
    setOtpError(null)

    try {
      // Send OTP to email
      const response = await authApi.sendOtp(data.email)

      if (response.error) {
        setApiError(response.error)
        return
      }

      // Store form data for later registration
      setFormData(data)
      setOtpEmail(data.email)
      setShowOtpStep(true)
      setResendTimer(60) // 60 seconds before resend allowed

    } catch (error) {
      console.error('Send OTP error:', error)
      setApiError(t("networkError"))
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setOtpError(t("otpInvalid"))
      return
    }

    setIsVerifyingOtp(true)
    setOtpError(null)

    try {
      // Verify OTP
      const verifyResponse = await authApi.verifyOtp(otpEmail, otpCode)

      if (verifyResponse.error) {
        setOtpError(verifyResponse.error)
        return
      }

      // OTP verified, now complete registration
      if (!formData) {
        setOtpError(t("networkError"))
        return
      }

      setIsLoading(true)
      setOtpError(null)

      // Prepare the payload according to backend schema
      const payload = {
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        ...(formData.username && { username: formData.username }),
        ...(formData.phone_number && { phone_number: formData.phone_number })
      }

      const registerResponse = await authApi.register(payload)

      if (registerResponse.error) {
        // Handle validation errors
        if (registerResponse.validationErrors) {
          Object.entries(registerResponse.validationErrors).forEach(([field, message]) => {
            setError(field as keyof SignupFormData, { message })
          })
        }
        
        setOtpError(registerResponse.error)
        return
      }

      // Success
      setSuccessMessage(t("accountCreated"))
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/auth/login')
      }, 2000)

    } catch (error) {
      console.error('Verify OTP/Registration error:', error)
      setOtpError(t("networkError"))
    } finally {
      setIsVerifyingOtp(false)
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendTimer > 0 || !otpEmail) return

    setIsSendingOtp(true)
    setOtpError(null)

    try {
      const response = await authApi.sendOtp(otpEmail)

      if (response.error) {
        setOtpError(response.error)
        return
      }

      setResendTimer(60) // Reset timer
      setOtpCode('') // Clear OTP input
    } catch (error) {
      console.error('Resend OTP error:', error)
      setOtpError(t("networkError"))
    } finally {
      setIsSendingOtp(false)
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
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10 mb-10">
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

      {/* OTP Step */}
      {showOtpStep ? (
        <div className="space-y-6">
          <div className="mb-6 p-4 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
            <p className="text-sm">
              {t("otpDescription", { email: otpEmail })}
            </p>
          </div>

          {otpError && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-800 border border-red-200 flex items-center">
              <XCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>{otpError}</span>
            </div>
          )}

          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">
              {t("enterOtp")} *
            </label>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setOtpCode(value)
                setOtpError(null)
              }}
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors text-center text-2xl tracking-widest font-mono ${
                otpError
                  ? 'border-red-500 focus:ring-red-500 bg-red-50'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              style={{ 
                '--tw-ring-color': '#3277AE',
                '--tw-ring-offset-color': '#3277AE'
              } as React.CSSProperties & { [key: string]: string }}
              placeholder="000000"
              disabled={isVerifyingOtp || isLoading}
              maxLength={6}
            />
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={otpCode.length !== 6 || isVerifyingOtp || isLoading}
              className="w-full p-3 text-white font-semibold rounded-lg focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: '#3277AE',
                '--tw-ring-color': '#3277AE'
              } as React.CSSProperties & { [key: string]: string }}
            >
              {isVerifyingOtp || isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isLoading ? t("registering") : t("verifyingOtp")}
                </span>
              ) : (
                t("verifyOtp")
              )}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendTimer > 0 || isSendingOtp}
              className="text-sm text-gray-600 hover:text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed"
              style={{ color: resendTimer > 0 ? '#9CA3AF' : '#3277AE' }}
            >
              {isSendingOtp ? (
                t("sendingOtp")
              ) : resendTimer > 0 ? (
                `${t("resendIn")} ${resendTimer}s`
              ) : (
                t("resendOtp")
              )}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setShowOtpStep(false)
                setOtpCode('')
                setOtpError(null)
                setFormData(null)
              }}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← Back to form
            </button>
          </div>
        </div>
      ) : (
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
            {isSendingOtp ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t("sendingOtp")}
              </span>
            ) : (
              t("registerButton")
            )}
          </button>
        </div>
      </form>
      )}

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
    </div>
  )
}