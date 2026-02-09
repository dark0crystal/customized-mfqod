"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { tokenManager } from "@/utils/tokenManager";
import { usePermissions } from "@/PermissionsContext";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const schema = z.object({
    first_name: z.string().min(1, "First name is required"),
    last_name: z.string().min(1, "Last name is required"),
    phone_number: z.string().optional(),
    email: z.string().email("Invalid email address"),
});

type FormFields = z.infer<typeof schema>;

export default function EditProfileForm({ userId }: { userId: string }) {
    const { hasPermission } = usePermissions();
    const [isLoading, setIsLoading] = useState(true);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<FormFields>({
        resolver: zodResolver(schema),
    });

    useEffect(() => {
        async function fetchUser() {
            try {
                const token = tokenManager.getAccessToken();
                const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/users/${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) throw new Error("Failed to fetch user data");

                const data = await response.json();
                setValue("first_name", data.first_name);
                setValue("last_name", data.last_name);
                setValue("phone_number", data.phone_number || "");
                setValue("email", data.email);
            } catch (error: any) {
                setErrorMessage(error.message);
            } finally {
                setIsLoading(false);
            }
        }

        if (userId) fetchUser();
    }, [userId, setValue]);

    const onSubmit = async (data: FormFields) => {
        setSuccessMessage(null);
        setErrorMessage(null);

        try {
            const token = tokenManager.getAccessToken();
            const response = await fetch(`${process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'}/api/users/${userId}`, {
                method: "PUT",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Failed to update profile");
            }

            setSuccessMessage("Profile updated successfully");
        } catch (error: any) {
            setErrorMessage(error.message);
        }
    };

    if (isLoading) return <LoadingSpinner />;

    if (!hasPermission('can_manage_users')) return null;

    return (
        <div className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">Edit Profile Info</h2>
                <p className="text-sm text-gray-500 mt-1">Update personal information</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <input
                            {...register("first_name")}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <input
                            {...register("last_name")}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        {...register("email")}
                        type="email"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                        {...register("phone_number")}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full px-4 py-2 bg-[#3277AE] text-white rounded-md hover:bg-[#2a6594] transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                </div>

                {successMessage && (
                    <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md">
                        {successMessage}
                    </div>
                )}

                {errorMessage && (
                    <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">
                        {errorMessage}
                    </div>
                )}
            </form>
        </div>
    );
}
