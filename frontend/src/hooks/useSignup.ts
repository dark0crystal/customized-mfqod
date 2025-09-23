import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SignupData {
  email: string
  password: string
  first_name: string
  last_name: string
  username?: string
  phone_number?: string
}

interface SignupResponse {
  id: string
  email: string
  username?: string
  first_name: string
  last_name: string
  phone_number?: string
  user_type: string
  active: boolean
  role?: string
  created_at: string
  updated_at: string
}

interface ApiError {
  detail: string
  validation_errors?: Array<{
    field: string
    message: string
  }>
}

export function useSignup() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const router = useRouter()

  const signup = async (data: SignupData): Promise<SignupResponse> => {
    setIsLoading(true)
    setError(null)
    setValidationErrors({})

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const responseData = await response.json()

      if (!response.ok) {
        const apiError = responseData as ApiError
        
        // Handle validation errors
        if (apiError.validation_errors) {
          const errors: Record<string, string> = {}
          apiError.validation_errors.forEach(({ field, message }) => {
            errors[field] = message
          })
          setValidationErrors(errors)
        }
        
        setError(apiError.detail || 'Registration failed')
        throw new Error(apiError.detail || 'Registration failed')
      }

      return responseData as SignupResponse
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Network error. Please try again.')
      }
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const clearErrors = () => {
    setError(null)
    setValidationErrors({})
  }

  return {
    signup,
    isLoading,
    error,
    validationErrors,
    clearErrors
  }
}