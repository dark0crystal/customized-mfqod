'use client';
import Image from 'next/image';
import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { tokenManager } from '@/utils/tokenManager';
import img from "../../../../../../../public/img3.jpeg"

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

interface Claim {
  id: string;
  claimTitle: string;
  claimContent: string;
  createdAt: string;
  approved: boolean;
  user?: {
    name: string;
    email: string;
  };
  images?: Array<{
    id: string;
    url: string;
  }>;
}

// Helper function to create authenticated headers
const getAuthHeaders = (): HeadersInit => {
  const token = tokenManager.getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

// Claims Component
export default function Claims({ postId }: { postId: string }) {
  const t = useTranslations('claims');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaimApproval(claimId: string, approval: boolean) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/${claimId}/approve`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ claimId, approval }),
      });

      if (response.ok) {
        console.log('Claim status updated');
        fetchClaims();
      } else {
        console.error('Failed to update claim status');
      }
    } catch (error) {
      console.error('Error updating claim approval:', error);
    }
  }

  async function fetchClaims() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/claims/item/${postId}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch claims');
      
      const data = await response.json();
      setClaims(data);
    } catch (err) {
      console.error('Error fetching claims:', err);
      setError(t('errorLoadingClaims'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">{t('title')}</h2>
      <button
        onClick={fetchClaims}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200"
      >
        {t('showClaims')}
      </button>

      {isLoading && <p className="mt-4 text-gray-500">{t('loadingClaims')}</p>}
      {error && <p className="mt-4 text-red-500">{error}</p>}

      {claims.length > 0 ? (
        <div className="mt-4 w-full">
          <div className="grid md:grid-cols-1 lg:grid-cols-2 grid-cols-1 lg:gap-4 gap-6">
            {claims.map((claim, index) => (
              <div key={index} className="p-4 border border-gray-300 rounded-lg bg-white w-full">
                <div className='w-full h-[300px] lg:h-[200px] relative rounded-lg overflow-hidden'>
                  <Image alt='image' src={img} fill objectFit='cover'/>
                </div>
                <div className='mt-3'>
                  <p className="text-gray-700">
                    <strong>{t('claimTitle')}:</strong> {claim.claimTitle}
                  </p>
                  <p className="text-gray-700">
                    <strong>{t('claimContent')}:</strong> {claim.claimContent}
                  </p>
                  <p className="text-gray-700">
                    <strong>{t('claimDate')}:</strong> {new Date(claim.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-gray-700">
                    <strong>{t('claimUserName')}:</strong> {claim.user?.name || 'N/A'}
                  </p>
                  <p className="text-gray-700">
                    <strong>{t('claimEmail')}:</strong> {claim.user?.email || 'N/A'}
                  </p>

                  <div className="mt-4">
                    <button
                      onClick={() => handleClaimApproval(claim.id, !claim.approved)}
                      className={`px-4 py-2 rounded-lg text-white transition-all duration-200 ${
                        claim.approved ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {claim.approved ? t('approved') : t('notApproved')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        !isLoading && <p className="mt-4 text-gray-500">{t('noClaimsAvailable')}</p>
      )}
    </div>
  );
}