
'use client';

import React, { useEffect } from "react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from "firebase/auth";
import { ArrowLeft, LayoutDashboard, FileText, Bot, Menu, BookHeart, UserCircle } from "lucide-react";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import Loading from "../loading";
import { LanguageProvider, useLanguage } from "@/context/language-context";

const translations = {
  th: {
    dataEntry: "การป้อนข้อมูล",
    openSensor: "เปิดใช้งาน",
    cardiacSummary: "สรุปสุขภาพหัวใจ",
    login: "Login",
    signOut: "ออกจากระบบ",
  },
  en: {
    dataEntry: "Data Entry",
    openSensor: "Activate",
    cardiacSummary: "Cardiac Summary",
    login: "Login",
    signOut: "Sign Out",
  }
};

function AppLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const auth = useAuth();
  const pathname = usePathname();
  const { lang, setLang } = useLanguage();
  const t = translations[lang];

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return <Loading />;
  }

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/');
  };

  const navItems = [
    { href: "/open-sensor", label: t.openSensor, icon: Bot },
    { href: "/data-entry", label: t.dataEntry, icon: FileText },
    { href: "/cardiac-summary", label: t.cardiacSummary, icon: BookHeart },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 no-print">
        <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/data-entry" className="flex items-center gap-2">
              <Icons.logo className="h-8 w-8 text-primary" />
              <h1 className="text-xl font-bold text-primary hidden sm:inline-block">CardioSnap</h1>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Button key={item.href} variant={pathname.startsWith(item.href) ? "secondary" : "ghost"} asChild>
                <Link href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
             <Button variant={lang === 'th' ? 'secondary' : 'ghost'} size="sm" onClick={() => setLang('th')}>TH</Button>
             <Button variant={lang === 'en' ? 'secondary' : 'ghost'} size="sm" onClick={() => setLang('en')}>EN</Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <UserCircle className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSignOut}>
                  {t.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

             {/* Mobile Navigation */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Open navigation menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {navItems.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href}>
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      <main className="w-full flex-1 p-4 sm:p-8">
        {children}
      </main>
    </div>
  );
}


export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </LanguageProvider>
  );
}
