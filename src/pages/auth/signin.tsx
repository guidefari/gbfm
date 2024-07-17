"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const form = { email, password };
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        setError("Failed to authenticate user");
        return;
      }
      const data = await response.json();
      if (data?.token) {
        router.push("/");
      } else {
        setError("Failed to authenticate user");
      }
    } catch (err) {
      setEmail("Failed to authenticate user");
    }
  };

  return (
    <div className="flex min-h-[65dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
            <LockIcon className="mr-2 h-4 w-4" />
            Sign In
          </div>
        </div>
        <Card>
          <CardContent className="space-y-4">
            <form>
              <div className="grid gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>

                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Sign in
                </Button>
              </div>
            </form>
          </CardContent>

        </Card>
        <ul
          className="text-sm font-medium text-muted-foreground"
        >
          <li>
            <Link href='/auth/signup'>Create a new account</Link>
          </li>
          <li>
            <Link
              href="/auth/reset-password"
            >
              Forgot password?
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <title>Lock Icon</title>
    </svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
      <title>Close icon</title>
    </svg>
  );
}
