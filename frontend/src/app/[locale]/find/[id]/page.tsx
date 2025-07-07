'use client';

import { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabase";
import { SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import ReactConfetti from 'react-confetti';
import CompressorFileInput from '../../../components/CompressorFileInput';
import Image from 'next/image';
import Footer from '@/app/components/Footer';
import { useSession } from "next-auth/react"
import { Link } from '@/i18n/routing';

// Define Zod validation schema
const schema = z.object({
  claimTitle: z.string().min(1, { message: "The Field is required!" }),
  claimContent: z.string().min(1, { message: "Please provide proof of ownership!" }),
});

type FormFields = {
  claimTitle: string;
  claimContent: string;
  images: File[];
};

export default function PostDetails({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<any | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [showForm, setShowForm] = useState(false); // State to toggle form visibility
  const [compressedFiles, setCompressedFiles] = useState<File[]>([]);

  const { data: session } = useSession()

  const { id } = params;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormFields>({
    resolver: zodResolver(schema),
  });

  // Fetch post details
  useEffect(() => {
    const fetchPostDetails = async () => {
      try {
        const response = await fetch(`/api/get-items/${id}`);
        if (response.ok) {
          const data = await response.json();
          setPost(data);
        } else {
          console.error('Failed to fetch post details');
        }
      } catch (error) {
        console.error('Error fetching post details:', error);
      }
    };
    fetchPostDetails();
  }, [id]);

  // Form submission
  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    try {
      const response = await fetch("/api/upload-claim", {
        method: "POST",
        body: JSON.stringify({ postId: id, body: data }),
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (response.ok) {
        setConfetti(true);

        // Upload images
        const imageUrls = await Promise.all(
          compressedFiles.map(async (file) => {
            const filePath = `${result.claimId}/${file.name}`;
            await supabase.storage.from("mfqodFiles").upload(filePath, file);
            return supabase.storage.from("mfqodFiles").getPublicUrl(filePath).data.publicUrl;
          })
        );

        // Send image URLs to the backend
        await fetch("/api/save-claim-image", {
          method: "POST",
          body: JSON.stringify({ claimId: result.claimId, imageUrls }),
          headers: { 'Content-Type': 'application/json' },
        });

        reset();
      } else {
        console.error("Failed to upload claim.");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  // Reset confetti after 7 seconds
  useEffect(() => {
    if (confetti) {
      setTimeout(() => setConfetti(false), 7000);
    }
  }, [confetti]);

  if (!post) return <p className="text-center text-gray-500">Loading post details...</p>;

  return (
      <div>

    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-3xl h-fit md:mt-24">
      {confetti && <ReactConfetti width={window.innerWidth} height={window.innerHeight} />}

      <div className='grid grid-rows-2 grid-cols-1 md:grid-rows-1 md:grid-cols-2'>
        <div className='order-2 row-span-1 md:col-span-1 md:order-1 mt-4'>

            <h2 className="text-3xl font-bold text-gray-800 mb-4">{post.title}</h2>
            <p className="text-gray-600 mb-2"><strong>Content:</strong> {post.content}</p>
            {/* Address */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Address:</h3>
              {Array.isArray(post?.address) && post.address.length > 0 ? (
                post.address.map((addr: any, index: number) => (
                  <div key={index} className="text-gray-600">
                    <p><strong>Place:</strong> {addr.place}</p>
                    <p><strong>Country:</strong> {addr.country}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No address available.</p>
              )}
            </div>

            {/* Toggle Form Button */}
            <button
              onClick={() => setShowForm(!showForm)}
              className="mb-6 px-4 py-2 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 transition"
            >
              {showForm ? "Hide Claim Form" : "Show Claim Form"}
            </button>

        </div>

            {/* Images */}
            <div className='order-1 md:order-2 row-span-1 md:col-span-1 '>
              <div className="w-full h-full">
                {Array.isArray(post?.images) && post.images.length > 0 ? (
                  post.images.map((image: string, index: number) => (
                    <div key={index} className='relative w-full h-full rounded-3xl overflow-hidden'>
                        <Image
                          fill 
                          objectFit='cover'
                          src={image}
                          alt={`Uploaded image ${index + 1}`}
                          className="absolute "
                        />
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No images uploaded.</p>
                )}
              </div>
        </div>


     
      </div>
     

      {/* Claim Form */}
      {showForm && (
        <>
        {session?.user?.email !=null  ? (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col space-y-6 mt-8">
          <div>
            <input
              id="claimTitle"
              {...register("claimTitle")}
              type="text"
              placeholder="Enter Title"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.claimTitle && <p className="mt-2 text-xs text-red-500">{errors.claimTitle.message}</p>}
          </div>
          <div>
            <input
              id="claimContent"
              {...register("claimContent")}
              type="text"
              placeholder="Provide proof of ownership"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.claimContent && <p className="mt-2 text-xs text-red-500">{errors.claimContent.message}</p>}
          </div>
          <CompressorFileInput onFilesSelected={setCompressedFiles} />
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full p-3 bg-green-600 text-white font-semibold rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
        ):(
          <div className='flex flex-col justify-center items-center h-52'>
            <h1>You Need To LogIn</h1>
            <div className='bg-blue-600 rounded-3xl  text-white p-4 mt-10'>
              
                <Link href="/login" className='m-12 text-xl font-semibold'>Log In</Link>
            </div>
              
          </div>
        ) }
        </>
      )}


      
    </div>
      <div className='md:mt-40'>
        <Footer/>
        </div>
    </div>
  );
}