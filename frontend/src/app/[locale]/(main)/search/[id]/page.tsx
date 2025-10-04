'use client';

import { useEffect, useState, use } from 'react';
import { SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import ReactConfetti from 'react-confetti';
import CompressorFileInput from "@/components/forms/CompressorFileInput";
import Image from 'next/image';
import Footer from "@/components/Footer";
import { Link } from '@/i18n/navigation';
import { tokenManager } from '@/utils/tokenManager';
import imageUploadService, { UploadError, UploadProgress } from '@/services/imageUploadService';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/utils/api';

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
  filename: string;
}

interface ItemData {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  item_type_name: string;
  user_name?: string;
  images?: ItemImage[];
  addresses?: Array<{
    place: string;
    country: string;
  }>;
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

  const [session, setSession] = useState<{ access_token: string; user: any } | null>(null);
  const t = useTranslations('claim');
  const router = useRouter();
  const { id } = use(params);

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
        
        const response = await apiRequest(`/api/items/public`);
        
        if (response.data) {
          const foundItem = response.data.items?.find((item: any) => item.id === id);
          if (foundItem) {
            setItem(foundItem);
          } else {
            setError('Item not found');
          }
        } else {
          setError(response.error || 'Failed to fetch item details');
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

  // Initialize session from token manager
  useEffect(() => {
    const accessToken = tokenManager.getAccessToken();
    const user = tokenManager.getUser();
    
    if (accessToken && user) {
      setSession({ access_token: accessToken, user });
    }
  }, []);

  const onSubmit: SubmitHandler<ClaimFormFields> = async (data) => {
    if (!session?.access_token) {
      setError('Please log in to submit a claim');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      const claimResponse = await apiRequest('/api/claims/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
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
      
      if (compressedFiles.length > 0) {
        const uploadResults = await Promise.allSettled(
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
              return { success: true, filename: file.name, response: uploadResponse };
            } catch (uploadError: any) {
              console.error(`Upload failed for ${file.name}:`, uploadError);
              return { 
                success: false, 
                filename: file.name, 
                error: uploadError.message || 'Upload failed' 
              };
            }
          })
        );

        const failedUploads = uploadResults
          .map((result, index) => ({ result, index }))
          .filter(({ result }) => result.status === 'rejected' || 
            (result.status === 'fulfilled' && !result.value.success))
          .map(({ result, index }) => {
            if (result.status === 'rejected') {
              return { filename: compressedFiles[index].name, error: 'Upload failed' };
            } else {
              return { 
                filename: result.value.filename, 
                error: result.value.error 
              };
            }
          });

        if (failedUploads.length > 0) {
          const failedFilenames = failedUploads.map(f => f.filename).join(', ');
          setError(`Claim created but ${failedUploads.length} image(s) failed to upload: ${failedFilenames}`);
        }
      }

      setConfetti(true);
      reset();
      setCompressedFiles([]);
      setShowForm(false);

    } catch (error: any) {
      console.error('Error submitting claim:', error);
      setError(error.message || 'Failed to submit claim');
    } finally {
      setIsUploading(false);
      setUploadProgress([]);
    }
  };

  useEffect(() => {
    if (confetti) {
      setTimeout(() => setConfetti(false), 7000);
    }
  }, [confetti]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
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
          <Link href="/search" className="text-indigo-600 hover:text-indigo-700">
            {t('backToSearch')}
          </Link>
        </div>
      </div>
    );
  }

  return (
      <div>

    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-3xl h-fit md:mt-24">
      {confetti && <ReactConfetti width={window.innerWidth} height={window.innerHeight} />}

      <div className='grid grid-rows-2 grid-cols-1 md:grid-rows-1 md:grid-cols-2'>
        <div className='order-2 row-span-1 md:col-span-1 md:order-1 mt-4'>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">{item.title}</h2>
          <p className="text-gray-600 mb-4"><strong>Description:</strong> {item.description}</p>
          
          <div className="mb-4">
            <p className="text-gray-600 mb-2"><strong>{t('type')}:</strong> {item.item_type_name || 'N/A'}</p>
            <p className="text-gray-600 mb-2"><strong>{t('posted')}:</strong> {new Date(item.created_at).toLocaleDateString()}</p>
            {item.user_name && (
              <p className="text-gray-600 mb-2"><strong>{t('postedBy')}:</strong> {item.user_name}</p>
            )}
          </div>

          {item.addresses && item.addresses.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('location')}:</h3>
              {item.addresses.map((addr, index) => (
                <div key={index} className="text-gray-600 mb-2">
                  <p><strong>{t('place')}:</strong> {addr.place}</p>
                  <p><strong>{t('country')}:</strong> {addr.country}</p>
                </div>
              ))}
            </div>
          )}

          {session?.user ? (
            <button
              onClick={() => setShowForm(!showForm)}
              className="mb-6 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {showForm ? t('cancelClaim') : t('claimThisItem')}
            </button>
          ) : (
            <div className="mb-6">
              <p className="text-gray-600 mb-2">{t('loginRequired')}</p>
              <Link 
                href="/auth/signin" 
                className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {t('signIn')}
              </Link>
            </div>
          )}
        </div>

        <div className='order-1 md:order-2 row-span-1 md:col-span-1'>
          <div className="w-full h-full">
            {item.images && item.images.length > 0 ? (
              <div className="grid gap-2">
                {item.images.map((image, index) => (
                  <div key={image.id} className='relative w-full h-64 rounded-3xl overflow-hidden'>
                    <Image
                      fill 
                      style={{ objectFit: 'cover' }}
                      src={image.url}
                      alt={`Item image ${index + 1}`}
                      className="absolute"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full h-64 bg-gray-100 rounded-3xl flex items-center justify-center">
                <p className="text-gray-500">{t('noImages')}</p>
              </div>
            )}
          </div>
        </div>

     
      </div>
     

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {showForm && session?.user && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-xl font-semibold text-gray-800 mb-6">{t('title')}</h3>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                {t('claimTitle')} *
              </label>
              <input
                id="title"
                {...register("title")}
                type="text"
                placeholder={t('claimTitlePlaceholder')}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                {t('proofOfOwnership')} *
              </label>
              <textarea
                id="description"
                {...register("description")}
                rows={4}
                placeholder={t('proofPlaceholder')}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('supportingImages')}
              </label>
              <p className="text-sm text-gray-500 mb-3">
                {t('supportingImagesDescription')}
              </p>
              <CompressorFileInput 
                onFilesSelected={setCompressedFiles}
                maxFiles={5}
                showValidation={true}
              />
            </div>

            {isUploading && uploadProgress.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">{t('uploading')}</p>
                {uploadProgress.map((progress, index) => (
                  <div key={index} className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${progress.percentage}%` }}
                    ></div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isSubmitting || isUploading}
                className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting || isUploading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isUploading ? t('uploading') : t('submitting')}
                  </span>
                ) : (
                  t('submitClaim')
                )}
              </button>
            </div>

            <p className="text-sm text-gray-500">
              {t('reviewNote')}
            </p>
          </form>
        </div>
      )}

      
    </div>
      <div className='md:mt-40'>
        <Footer/>
        </div>
    </div>
  );
}