"use client";
import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Phone, UserCheck, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface UserStatus {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  phone_number: string;
  status_name: string;
}

interface FormErrors {
  [key: string]: string;
}

interface SubmitStatus {
  type: 'success' | 'error';
  message: string;
}

export default function Register(): JSX.Element {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    phone_number: '',
    status_name: '',
  });

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus | null>(null);
  const [statuses, setStatuses] = useState<UserStatus[]>([]);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState<boolean>(true);

  useEffect(() => {
    const fetchStatuses = async (): Promise<void> => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/user-status/`);
        if (response.ok) {
          const data: UserStatus[] = await response.json();
          setStatuses(data);
        } else {
          console.error('Failed to fetch user statuses');
        }
      } catch (error) {
        console.error('Error fetching user statuses:', error);
      } finally {
        setIsLoadingStatuses(false);
      }
    };
    fetchStatuses();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.first_name) newErrors.first_name = 'First name is required';
    if (!formData.last_name) newErrors.last_name = 'Last name is required';
    if (!formData.phone_number) newErrors.phone_number = 'Phone number is required';
    if (!formData.status_name) newErrors.status_name = 'Status is required';

    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    if (formData.phone_number && !phoneRegex.test(formData.phone_number)) {
      newErrors.phone_number = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validateForm()) return;

    setIsLoading(true);
    setSubmitStatus(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          middle_name: formData.middle_name || null,
          last_name: formData.last_name,
          phone_number: formData.phone_number,
          status_name: formData.status_name,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus({ type: 'success', message: data.message });
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          first_name: '',
          middle_name: '',
          last_name: '',
          phone_number: '',
          status_name: ''
        });
      } else {
        setSubmitStatus({ type: 'error', message: data.detail || 'Registration failed' });
      }
    } catch (error) {
      setSubmitStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const getInputClassName = (fieldName: string): string => {
    const baseClasses = "w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors";
    return errors[fieldName]
      ? `${baseClasses} border-red-500 focus:ring-red-500`
      : `${baseClasses} border-gray-300 focus:ring-blue-500`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <UserCheck className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 mt-2">Join us by creating your account</p>
        </div>

        {submitStatus && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            submitStatus.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {submitStatus.type === 'success'
              ? <CheckCircle className="h-5 w-5 mr-2" />
              : <XCircle className="h-5 w-5 mr-2" />}
            {submitStatus.message}
          </div>
        )}

        <div className="space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} className={getInputClassName('email')} placeholder="Enter your email" />
            </div>
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleInputChange} className={getInputClassName('password')} placeholder="Enter your password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className={getInputClassName('confirmPassword')} placeholder="Confirm your password" />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
          </div>

          {/* Names */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} className={getInputClassName('first_name')} placeholder="First name" />
              </div>
              {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} className={getInputClassName('last_name')} placeholder="Last name" />
              </div>
              {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>}
            </div>
          </div>

          {/* Middle Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input type="text" name="middle_name" value={formData.middle_name} onChange={handleInputChange} className={getInputClassName('middle_name')} placeholder="Middle name (optional)" />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleInputChange} className={getInputClassName('phone_number')} placeholder="Enter your phone number" />
            </div>
            {errors.phone_number && <p className="text-red-500 text-sm mt-1">{errors.phone_number}</p>}
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <select name="status_name" value={formData.status_name} onChange={handleInputChange} className={getInputClassName('status_name')} disabled={isLoadingStatuses}>
                <option value="">{isLoadingStatuses ? 'Loading...' : 'Select status'}</option>
                {statuses.map(status => (
                  <option key={status.id} value={status.name}>
                    {status.name}
                  </option>
                ))}
              </select>
              {isLoadingStatuses && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 animate-spin" />
              )}
            </div>
            {errors.status_name && <p className="text-red-500 text-sm mt-1">{errors.status_name}</p>}
          </div>

          {/* Submit */}
          <button type="button" onClick={handleSubmit} disabled={isLoading || isLoadingStatuses} className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center ${
            isLoading || isLoadingStatuses ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50'
          } text-white`}>
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="text-blue-600 hover:text-blue-800 font-medium">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
