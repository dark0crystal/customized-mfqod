import React from 'react'
import { useTranslations } from 'next-intl'

interface PasswordStrengthProps {
  password: string
  className?: string
}

export function PasswordStrengthIndicator({ password, className = '' }: PasswordStrengthProps) {
  const t = useTranslations('auth.register.validation')
  
  if (!password) return null

  const meetsRequirement = password.length >= 8

  return (
    <div className={`text-xs mt-1 ${meetsRequirement ? 'text-green-600' : 'text-red-600'} ${className}`}>
      {meetsRequirement ? '✓ ' : '✗ '}{t('passwordMinLength')}
    </div>
  )
}

export default PasswordStrengthIndicator