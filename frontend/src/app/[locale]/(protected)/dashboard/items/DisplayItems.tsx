'use client';

import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { MdArrowOutward } from 'react-icons/md';

interface LocationData {
  organization_name?: string;
  branch_name?: string;
  full_location?: string;
}

type Post = {
  approval: any;
  id: string;
  temporaryDeletion: boolean;
  title: string;
  content: string;
  description?: string;
  type: string;
  location?: LocationData;
  uploadedPostPhotos: { postUrl: string }[]; // Updated to include postUrl structure
};

export default function DisplayPosts() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgName = searchParams.get('orgName');
  const placeName = searchParams.get('placeName');

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');

  useEffect(() => {
    if (orgName) {
      const fetchPosts = async () => {
        try {
          const response = await fetch(`/api/get-verified-posts?orgName=${orgName}&placeName=${placeName}`);
          const data = await response.json();
          setRole(data.role);
          setPosts(data.posts);
        } catch (error) {
          console.error('Error fetching posts:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchPosts();
    }
  }, [orgName, placeName]);

  const handleHide = async (postId: string) => {
    const isConfirmed = window.confirm("Are you sure you want to hide this post?");
    if (!isConfirmed) return;
  
    try {
      await fetch(`/api/get-verified-posts?postId=${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temporaryDeletion: true }),
      });
  
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId ? { ...post, temporaryDeletion: true } : post
        )
      );
    } catch (error) {
      console.error('Error hiding post:', error);
    }
  };
  
  const handleDelete = async (postId: string) => {
    const isConfirmed = window.confirm("Are you sure you want to delete this post permanently?");
    if (!isConfirmed) return;
  
    try {
      await fetch(`/api/get-verified-posts?postId=${postId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temporaryDeletion: true }),
      });
  
      setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };
  

  if (loading) {
    return <div className="text-center text-xl mt-8">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-center mb-6">User Posts</h1>
      {posts.length === 0 ? (
        <p className="text-center text-gray-600">No posts available</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <div
              key={post.id}
              className={`relative  rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 w-[350px] min-w-[350px] ${
                post.temporaryDeletion ? 'hidden' : 'block'}  ${post.approval ? 'bg-white':'bg-red-300'}`}
            >
              {/* Image Section */}
              <div className="relative h-40">
                {post.uploadedPostPhotos.length > 0 && post.uploadedPostPhotos[0].postUrl ? (
                  <Image
                    src={post.uploadedPostPhotos[0].postUrl}
                    alt={post.title}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-t-2xl"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-200 text-gray-500">
                    No Image Available
                  </div>
                )}
                <button
                  title="Go to details"
                  onClick={() => router.push(`/dashboard/posts/${post.id}`)}
                  className="absolute bottom-2 right-2 p-3 bg-white text-black text-xl rounded-full hover:bg-indigo-200 transition-colors shadow-md"
                >
                  <MdArrowOutward />
                </button>
              </div>

              {/* Content Section */}
              <div className="p-4">
                <h2 className="text-lg font-bold text-gray-800">{post.title}</h2>
                <p className="text-gray-600 text-sm mt-2 line-clamp-2 overflow-hidden text-ellipsis">
                  {post.description || post.content}
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  {post.location?.full_location || "Location not specified"}
                </p>
                <span className="text-xs text-gray-500">{post.type}</span>
              </div>

              {/* Action Buttons */}
              {(role === 'TECHADMIN' || role === 'ADMIN') && (
                <div className="absolute top-2 right-2 space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/items/${post.id}`);
                    }}
                    className="text-sm text-white bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded shadow"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHide(post.id);
                    }}
                    className="text-sm text-white bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded shadow"
                  >
                    Hide
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(post.id);
                    }}
                    className="text-sm text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded shadow"
                  >
                    Delete
                  </button>
                </div>
              )}
              {role === 'VERIFIED' && (
                <div className="absolute top-2 right-2 space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/items/${post.id}`);
                    }}
                    className="text-sm text-white bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded shadow"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHide(post.id);
                    }}
                    className="text-sm text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded shadow"
                  >
                    Hide
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}