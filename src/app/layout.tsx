import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase';
import { EcgProvider } from '@/context/ecg-context';
import { MurmurProvider } from '@/context/murmur-context';
import { PPGProvider } from '@/context/ppg-context';
import { VitalsProvider } from '@/context/vitals-context';

export const metadata: Metadata = {
  title: 'CardioSnap',
  description: 'An AI-powered cardiovascular risk assessment tool.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <EcgProvider>
            <MurmurProvider>
              <PPGProvider>
                <VitalsProvider>
                  {children}
                </VitalsProvider>
              </PPGProvider>
            </MurmurProvider>
          </EcgProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
