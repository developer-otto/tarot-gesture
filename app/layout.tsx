import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ARCANA — 手势塔罗牌',
  description: '用手势控制塔罗牌的命运',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}
