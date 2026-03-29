
'use client';

import { useUser } from "@/firebase";
import Loading from "./loading";
import { AuthGate } from "@/components/auth-gate";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/cardiac-summary');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading) {
    return <Loading />;
  }

  if (!user) {
    return <AuthGate />;
  }

  return <Loading />;
}
