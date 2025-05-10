import './globals.css'
import { Toaster } from 'sonner'
import { Inter } from 'next/font/google'
import Head from 'next/head'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Customer Points Tracker',
  description: 'Modern customer points tracking app',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body className={`${inter.className} bg-[#f7fcfa] dark:bg-[#18181b] transition-colors`}>
        <Toaster richColors position="top-center" />
        {children}
      </body>
    </html>
  )
}
