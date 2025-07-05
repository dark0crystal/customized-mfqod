'use client';
import Image from 'next/image';
import React, { useState } from 'react';
import img from "../../../../../../../public/img3.jpeg"

// Claims Component
export default function Claims({ postId }: { postId: string }) {
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaimApproval(claimId: string, approval: boolean) {
    try {
      const response = await fetch('/api/post-claim-approval', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, approval }),
      });

      if (response.ok) {
        console.log('Claim status updated');
        fetchClaims();
      } else {
        console.error('Failed to update claim status');
      }
    } catch (error) {
      console.error('Error updating claim approval');
    }
  }

  async function fetchClaims() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/get-claims?postId=${postId}`);
      if (!response.ok) throw new Error('Failed to fetch claims');
      
      const data = await response.json();
      setClaims(data);
    } catch (err) {
      setError('Error fetching claims.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-6 w-full">
      <button
        onClick={fetchClaims}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-all duration-200"
      >
        Show Claims
      </button>

      {isLoading && <p className="mt-4 text-gray-500">Loading claims...</p>}
      {error && <p className="mt-4 text-red-500">{error}</p>}

      {claims.length > 0 ? (
        <div className="mt-4 w-full">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Claims</h3>
          <div className="grid md:grid-cols-1 lg:grid-cols-2 grid-cols-1 lg:gap-4 gap-12">
            {claims.map((claim, index) => (
              <div key={index} className="p-4 border border-blue-500 rounded-lg shadow bg-white w-full ">
                <div className='w-full h-[300px] lg:h-[200px] relative rounded-xl overflow-hidden' >
                  <Image alt='image' src={img} fill objectFit='cover'/>
                </div>
                <div className='mt-3'>
              
                  <p className="text-gray-700">
                    <strong>Title:</strong> {claim.claimTitle}
                  </p>
                  <p className="text-gray-700">
                    <strong>Content:</strong> {claim.claimContent}
                  </p>
                  <p className="text-gray-700">
                    <strong>Date:</strong> {new Date(claim.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-gray-700">
                    <strong>User Name:</strong> {claim.user.name}
                  </p>
                  <p className="text-gray-700">
                    <strong>Email:</strong> {claim.user.email}
                  </p>
                 


                  <div className="mt-4">
                    <button
                      onClick={() => handleClaimApproval(claim.id, !claim.approved)}
                      className={`px-4 py-2 rounded-lg text-white transition-all duration-200 ${
                        claim.approved ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {claim.approved ? 'Approved' : 'Not Approved'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        !isLoading && <p className="mt-4 text-gray-500">No claims available for this post.</p>
      )}
    </div>
  );
}