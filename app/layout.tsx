import type { Metadata, Viewport } from 'next'
import { Atkinson_Hyperlegible } from 'next/font/google'
import './globals.css'

const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
})

export const metadata: Metadata = {
  title: 'Banco de Alimentos · Gestión',
  description: 'Registro de donaciones, inventario por caducidad y entregas justas a familias del barrio.',
}

export const viewport: Viewport = {
  themeColor: '#FAF8F2',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`light ${atkinson.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground text-lg">{children}</body>
    </html>
  )
}
