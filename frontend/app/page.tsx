"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../lib/auth";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (auth.isLoggedIn()) {
      router.replace("/vault");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
