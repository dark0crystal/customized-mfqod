import React from 'react'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface PasswordStrengthProps {
  password: string
  className?: string
}

interface StrengthCheck {
  regex: RegExp
  message: string
  weight: number
}

const strengthChecks: StrengthCheck[] = [
  { regex: /.{8,}/, message: 'At least 8 characters', weight: 1 },
  { regex: /.{12,}/, message: 'At least 12 characters (bonus)', weight: 0.5 },
  { regex: /[A-Z]/, message: 'One uppercase letter', weight: 1 },
  { regex: /[a-z]/, message: 'One lowercase letter', weight: 1 },
  { regex: /\d/, message: 'One number', weight: 1 },
  { regex: /[!@#$%^&*(),.?":{}|<>]/, message: 'One special character', weight: 1 },
  { regex: /^(?!.*(.)\1{2,})/, message: 'No repeated characters', weight: 0.5 },
]

export function PasswordStrengthIndicator({ password, className = '' }: PasswordStrengthProps) {
  if (!password) return null

  const results = strengthChecks.map(check => ({
    ...check,
    passed: check.regex.test(password)
  }))

  const requiredChecks = results.filter(check => check.weight === 1)
  const bonusChecks = results.filter(check => check.weight === 0.5)
  
  const passedRequired = requiredChecks.filter(check => check.passed)
  const passedBonus = bonusChecks.filter(check => check.passed)
  
  const baseScore = passedRequired.length / requiredChecks.length
  const bonusScore = passedBonus.length * 0.1
  const totalScore = Math.min(baseScore + bonusScore, 1)

  const getStrengthLevel = () => {
    if (totalScore >= 0.9) return { level: 'Very Strong', color: 'emerald', textColor: 'text-emerald-600' }
    if (totalScore >= 0.7) return { level: 'Strong', color: 'green', textColor: 'text-green-600' }
    if (totalScore >= 0.5) return { level: 'Medium', color: 'yellow', textColor: 'text-yellow-600' }
    if (totalScore >= 0.3) return { level: 'Weak', color: 'orange', textColor: 'text-orange-600' }
    return { level: 'Very Weak', color: 'red', textColor: 'text-red-600' }
  }

  const strength = getStrengthLevel()
  const progressPercentage = totalScore * 100

  return (
    <div className={`p-4 bg-gray-50 rounded-lg border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">Password Strength</span>
        <div className="flex items-center space-x-2">
          <span className={`text-sm font-semibold ${strength.textColor}`}>
            {strength.level}
          </span>
          <span className="text-xs text-gray-500">
            {Math.round(progressPercentage)}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              strength.color === 'emerald' ? 'bg-emerald-500' :
              strength.color === 'green' ? 'bg-green-500' :
              strength.color === 'yellow' ? 'bg-yellow-500' :
              strength.color === 'orange' ? 'bg-orange-500' :
              'bg-red-500'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Requirements */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          Requirements
        </h4>
        
        {/* Required checks */}
        {requiredChecks.map((check, index) => (
          <div key={index} className="flex items-center space-x-2">
            {check.passed ? (
              <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
            ) : (
              <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
            )}
            <span className={`text-xs ${
              check.passed ? 'text-green-700' : 'text-red-600'
            }`}>
              {check.message}
            </span>
          </div>
        ))}

        {/* Bonus checks */}
        {bonusChecks.length > 0 && (
          <>
            <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide mt-3">
              Bonus Security
            </h4>
            {bonusChecks.map((check, index) => (
              <div key={index} className="flex items-center space-x-2">
                {check.passed ? (
                  <CheckCircle className="h-3 w-3 text-blue-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-gray-400 flex-shrink-0" />
                )}
                <span className={`text-xs ${
                  check.passed ? 'text-blue-700' : 'text-gray-500'
                }`}>
                  {check.message}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Security Tips */}
      {totalScore < 0.7 && (
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
          <p className="text-xs text-blue-800">
            <strong>Tip:</strong> Use a mix of uppercase, lowercase, numbers, and symbols. 
            Avoid common words or personal information.
          </p>
        </div>
      )}
    </div>
  )
}

export default PasswordStrengthIndicator