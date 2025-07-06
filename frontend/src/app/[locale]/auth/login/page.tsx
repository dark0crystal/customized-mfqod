'use client'

import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { cookieUtils } from "@/utils/cookies" // Adjust path as needed

const loginSchema = z.object({
  identifier: z.string().min(3, "Username or Email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

const host_name = process.env.NEXT_PUBLIC_HOST_NAME

type LoginFormData = z.infer<typeof loginSchema>

export default function Login() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`${host_name}/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: data.identifier,
          password: data.password
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.detail || "Login failed")
      }

      // Store token and user data in cookies using utility functions
      cookieUtils.set("token", result.token, 7) // Expires in 7 days
      cookieUtils.set("user", JSON.stringify(result.user), 7)
      
      setSuccess("Login successful!")
      console.log("Login success:", result)
      
      // Redirect user after successful login
      setTimeout(() => {
        router.push("/dashboard") // or wherever you want to redirect
      }, 1000)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
      console.error("Error during login:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-10 p-4 border rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Username or Email</label>
          <input
            type="text"
            {...register("identifier")}
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          {errors.identifier && (
            <p className="text-red-500 text-sm mt-1">{errors.identifier.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            {...register("password")}
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          {errors.password && (
            <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  )
}