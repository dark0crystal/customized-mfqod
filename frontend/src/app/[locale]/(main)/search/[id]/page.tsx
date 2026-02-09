'use client';

import { useEffect, useState, use } from 'react';
import { SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import ReactConfetti from 'react-confetti';
import CompressorFileInput from "@/components/forms/CompressorFileInput";
import LocationTracking from "@/components/LocationTracking";
import Footer from "@/components/Footer";
import { Link } from '@/i18n/navigation';
import { tokenManager } from '@/utils/tokenManager';
import imageUploadService, { UploadProgress } from '@/services/imageUploadService';
import { useTranslations, useLocale } from 'next-intl';
import { apiRequest } from '@/utils/api';
import { formatDateOnly } from '@/utils/dateFormatter';
import ImageCarousel, { CarouselImage } from '@/components/ImageCarousel';

const claimSchema = z.object({
  title: z.string().min(1, { message: "Title is required!" }),
  description: z.string().min(10, { message: "Please provide detailed proof of ownership (minimum 10 characters)" }),
});

type ClaimFormFields = {
  title: string;
  description: string;
};

interface ItemImage {
  id: string;
  url: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface ItemType {
  id: string;
  name_ar?: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface Organization {
  id: string;
  name_ar?: string;
  name_en?: string;
}

interface Branch {
  id: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  organization?: Organization;
}

interface Address {
  id: string;
  is_current: boolean;
  branch?: Branch;
  full_location?: string;
  created_at: string;
  updated_at: string;
}

interface Location {
  organization_name_ar?: string;
  organization_name_en?: string;
  branch_name_ar?: string;
  branch_name_en?: string;
  full_location?: string;
}

interface ItemData {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  claims_count: number;
  temporary_deletion: boolean;
  status?: string;  // Item status: cancelled, approved, pending
  approval: boolean;  // DEPRECATED: kept for backward compatibility
  is_hidden?: boolean;  // Whether item images are hidden from regular users
  item_type_id?: string;
  user_id?: string;
  item_type?: ItemType;
  user?: User;
  images: ItemImage[];
  addresses?: Address[];
  location?: Location;
}

export default function ItemDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const [item, setItem] = useState<ItemData | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [compressedFiles, setCompressedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [session, setSession] = useState<{ token: string; user: { id: string; email: string; first_name: string; last_name: string } } | null>(null);
  const t = useTranslations('claim');
  const locale = useLocale();
  const { id } = use(params);

  // Helper function to get localized name
  const getLocalizedName = (nameAr?: string, nameEn?: string): string => {
    if (locale === 'ar' && nameAr) return nameAr;
    if (locale === 'en' && nameEn) return nameEn;
    return nameAr || nameEn || '';
  };

  // Helper function to get image URL
  const getImageUrl = (imageUrl: string): string => {
    if (!imageUrl) return '';
    if (/^https?:\/\//.test(imageUrl)) return imageUrl;
    let processedUrl = imageUrl.replace('/uploads/images/', '/static/images/');
    if (!processedUrl.startsWith('/')) {
      processedUrl = '/' + processedUrl;
    }
    const baseUrl = (process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000').replace(/\/$/, '');
    return `${baseUrl}${processedUrl}`;
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ClaimFormFields>({
    resolver: zodResolver(claimSchema),
  });

  useEffect(() => {
    const fetchItemDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

        // Get authentication token
        const getTokenFromCookies = (): string | null => {
          if (typeof document === "undefined") return null;
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'token') {
              return decodeURIComponent(value);
            }
          }
          return null;
        };

        const token = getTokenFromCookies();
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/api/items/${id}`, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError('Item not found or not approved for public viewing');
          } else {
            setError(`Failed to fetch item details: ${response.status}`);
          }
        } else {
          const data = await response.json();
          setItem(data);
        }
      } catch (error) {
        console.error('Error fetching item details:', error);
        setError('Error loading item details');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchItemDetails();
    }
  }, [id]);

  useEffect(() => {
    const accessToken = tokenManager.getAccessToken();
    const user = tokenManager.getUser();
    if (accessToken && user) {
      setSession({ token: accessToken, user });
    }
  }, []);

  useEffect(() => {
    if (confetti) {
      setTimeout(() => setConfetti(false), 7000);
    }
  }, [confetti]);

  useEffect(() => {
    const isAuthenticated = tokenManager.isAuthenticated();
    if (!isAuthenticated) {
      setSession(null);
    }
  }, []);

  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);

  const onSubmit: SubmitHandler<ClaimFormFields> = async (data) => {
    if (!session?.token) {
      setError('Please log in to submit a claim');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setClaimSuccessMessage(null);

      const claimResponse = await apiRequest('/api/claims/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          item_id: id
        })
      });

      if (claimResponse.error) {
        throw new Error(claimResponse.error || 'Failed to create claim');
      }

      const claimResult = claimResponse.data;

      // eslint-disable-next-line prefer-const
      let uploadedFilesList: string[] = [];
      // eslint-disable-next-line prefer-const
      let failedUploads: { filename: string; error: string }[] = [];

      if (compressedFiles.length > 0) {
        await Promise.allSettled(
          compressedFiles.map(async (file, index) => {
            try {
              const uploadResponse = await imageUploadService.uploadImage(
                file,
                'claim',
                claimResult.id,
                (progress) => {
                  setUploadProgress(prev => {
                    const newProgress = [...prev];
                    newProgress[index] = progress;
                    return newProgress;
                  });
                }
              );
              uploadedFilesList.push(file.name);
              return { success: true, filename: file.name, response: uploadResponse };
            } catch (uploadError: unknown) {
              failedUploads.push({
                filename: file.name,
                error: uploadError instanceof Error ? uploadError.message : 'Upload failed'
              });
              return {
                success: false,
                filename: file.name,
                error: uploadError instanceof Error ? uploadError.message : 'Upload failed'
              };
            }
          })
        );
      }

      setConfetti(true);
      setClaimSuccessMessage(t('claimSubmitted') || 'Claim submitted successfully!');
      reset();
      setCompressedFiles([]);
      setShowForm(false);

    } catch (error: unknown) {
      console.error('Error submitting claim:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit claim');
    } finally {
      setIsUploading(false);
      setUploadProgress([]);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#3277AE' }}></div>
          <p className="text-gray-500">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || t('itemNotFound')}</p>
          <Link href="/search" className="hover:opacity-80 transition-opacity" style={{ color: '#3277AE' }}>
            {t('backToSearch')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {confetti && <ReactConfetti width={window.innerWidth} height={window.innerHeight} />}

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 md:py-12">
        {/* Back Button */}
        <div className="mb-4 sm:mb-6">
          <Link
            href="/search"
            className="inline-flex items-center text-sm sm:text-base hover:opacity-80 transition-opacity"
            style={{ color: '#3277AE' }}
          >
            {t('backToSearch')}
          </Link>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 p-4 sm:p-6 lg:p-8'>
            {/* Content Section */}
            <div className='order-2 lg:order-1 space-y-4 sm:space-y-6'>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight">{item.title}</h1>
                <div className="h-px w-16 sm:w-20 bg-gray-300 mb-4 sm:mb-6"></div>
              </div>

              <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none">
                <p className="text-gray-700 leading-relaxed text-sm sm:text-base">{item.description}</p>
              </div>

              {/* Item Details */}
              <div className="bg-gray-50 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">{t('itemDetails')}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm text-gray-500">{t('type')}</p>
                    <p className="font-medium text-gray-900 text-sm sm:text-base">{item.item_type ? getLocalizedName(item.item_type.name_ar, item.item_type.name_en) || 'N/A' : 'N/A'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm text-gray-500">{t('posted')}</p>
                    <p className="font-medium text-gray-900 text-sm sm:text-base">{formatDateOnly(item.created_at)}</p>
                  </div>

                  {item.user && (
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-gray-500">{t('postedBy')}</p>
                      <p className="font-medium text-gray-900 text-sm sm:text-base">{item.user.first_name} {item.user.last_name}</p>
                    </div>
                  )}

                  {item.claims_count > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-gray-500">{t('claims')}</p>
                      <p className="font-medium text-gray-900 text-sm sm:text-base">{item.claims_count}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Location History Section */}
              {item.addresses && item.addresses.length > 0 && (
                <LocationTracking addresses={item.addresses} />
              )}

              {/* Claim Section: Show success message */}
              <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                {claimSuccessMessage && (
                  <div className="mb-4 p-3 sm:p-4 bg-green-50 border border-green-200 rounded">
                    <span className="text-green-700 font-semibold text-sm sm:text-base">
                      {claimSuccessMessage}
                    </span>
                  </div>
                )}

                {session?.user ? (
                  <div className="text-center">
                    <button
                      onClick={() => setShowForm(!showForm)}
                      className="w-full px-6 sm:px-8 py-3 sm:py-4 bg-white border-2 font-semibold text-sm sm:text-base rounded-lg hover:opacity-90 transition-all duration-200"
                      style={{ borderColor: '#3277AE', color: '#3277AE' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f7ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      {showForm ? (
                        <span className="flex items-center justify-center">
                          {t('cancelClaim')}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          {t('claimThisItem')}
                        </span>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">{t('loginRequired')}</p>
                    <Link
                      href="/auth/login"
                      className="inline-block px-6 sm:px-8 py-3 sm:py-4 bg-white border-2 font-semibold text-sm sm:text-base rounded-lg hover:opacity-90 transition-all duration-200"
                      style={{ borderColor: '#3277AE', color: '#3277AE' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f7ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                    >
                      <span className="flex items-center justify-center">
                        {t('signIn')}
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Image Section */}
            <div className='order-1 lg:order-2'>
              <div className="lg:sticky lg:top-8">
                {item.images && item.images.length > 0 ? (
                  <div className="w-full rounded-lg sm:rounded-xl lg:rounded-2xl overflow-hidden shadow-xl" style={{ minHeight: '250px' }}>
                    <ImageCarousel
                      images={item.images.map((img): CarouselImage => ({
                        id: img.id,
                        url: getImageUrl(img.url),
                        alt: img.description || `Item image`,
                        description: img.description,
                      }))}
                      isModal={false}
                      showCounter={true}
                      showDots={true}
                      className="rounded-lg sm:rounded-xl lg:rounded-2xl"
                    />
                  </div>
                ) : (
                  <div className="w-full h-64 sm:h-80 lg:h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-gray-500 text-base sm:text-lg font-medium">{t('noImages')}</p>
                      <p className="text-gray-400 text-xs sm:text-sm mt-1">{t('noImagesDescription')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Claim Form */}
        {showForm && session?.user && (
          <div className="mt-6 sm:mt-8 bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-50 p-4 sm:p-6 border-b">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
                {t('title')}
              </h3>
            </div>
            <div className="p-4 sm:p-6 lg:p-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
                <div>
                  <label htmlFor="title" className="block text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">
                    {t('claimTitle')} *
                  </label>
                  <input
                    id="title"
                    {...register("title")}
                    type="text"
                    placeholder={t('claimTitlePlaceholder')}
                    className="w-full p-3 sm:p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 text-sm sm:text-base lg:text-lg"
                    style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties & { [key: string]: string }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3277AE';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                  />
                  {errors.title && <p className="mt-2 text-sm text-red-600 font-medium">{errors.title.message}</p>}
                </div>

                <div>
                  <label htmlFor="description" className="block text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">
                    {t('proofOfOwnership')} *
                  </label>
                  <textarea
                    id="description"
                    {...register("description")}
                    rows={6}
                    placeholder={t('proofPlaceholder')}
                    className="w-full p-3 sm:p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 text-sm sm:text-base lg:text-lg resize-none"
                    style={{ '--tw-ring-color': '#3277AE' } as React.CSSProperties & { [key: string]: string }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3277AE';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                  />
                  {errors.description && <p className="mt-2 text-sm text-red-600 font-medium">{errors.description.message}</p>}
                </div>

                <div>
                  <label className="block text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">
                    {t('supportingImages')}
                  </label>
                  <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                    {t('supportingImagesDescription')}
                  </p>
                  <div className="border border-dashed border-gray-300 rounded-lg p-4 sm:p-6 hover:border-gray-400 transition-colors duration-200">
                    <CompressorFileInput
                      onFilesSelected={setCompressedFiles}
                      maxFiles={5}
                      showValidation={true}
                    />
                  </div>
                </div>

                {isUploading && uploadProgress.length > 0 && (
                  <div className="space-y-3 sm:space-y-4">
                    <p className="text-base sm:text-lg font-semibold text-gray-700">{t('uploading')}</p>
                    {uploadProgress.map((progress, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>File {index + 1}</span>
                          <span>{progress.percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="h-3 rounded-full transition-all duration-300"
                            style={{ backgroundColor: '#3277AE', width: `${progress.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting || isUploading}
                    className="w-full py-3 sm:py-4 px-4 sm:px-6 text-white font-bold text-base sm:text-lg rounded-lg focus:outline-none focus:ring-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200"
                    style={{
                      backgroundColor: '#3277AE',
                      '--tw-ring-color': '#3277AE'
                    } as React.CSSProperties & { [key: string]: string }}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = '#2a5f94';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = '#3277AE';
                      }
                    }}
                  >
                    {isSubmitting || isUploading ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                        {isUploading ? t('uploading') : t('submitting')}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        {t('submitClaim')}
                      </span>
                    )}
                  </button>
                </div>

                <div className="border rounded-lg p-4" style={{ backgroundColor: '#f0f7ff', borderColor: '#3277AE' }}>
                  <p className="text-sm font-medium" style={{ color: '#3277AE' }}>
                    {t('reviewNote')}
                  </p>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <div className='mt-16'>
        <Footer />
      </div>
    </div>
  );
}