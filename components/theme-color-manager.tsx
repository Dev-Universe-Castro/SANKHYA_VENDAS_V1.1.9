
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function ThemeColorManager() {
  const pathname = usePathname()

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    
    if (!metaThemeColor) return

    // Define cores baseadas na rota
    // oklch(0.25 0.01 240) convertido para hex aproximado: #3B3F4A
    const darkColor = '#3B3F4A'
    let themeColor = '#FFFFFF' // Branco por padrão (login/register)
    
    if (pathname === '/' || pathname === '/register' || pathname?.startsWith('/offline')) {
      themeColor = '#FFFFFF' // Branco para login, registro e offline
    } else {
      themeColor = darkColor // oklch(0.25 0.01 240) para todas as outras páginas
    }

    metaThemeColor.setAttribute('content', themeColor)
    
    // Atualizar cor da barra de navegação do Android (se suportado)
    if (typeof window !== 'undefined') {
      // Atualizar meta tag para navbar do Android
      let navbarMeta = document.querySelector('meta[name="msapplication-navbutton-color"]') as HTMLMetaElement
      if (!navbarMeta) {
        navbarMeta = document.createElement('meta')
        navbarMeta.name = 'msapplication-navbutton-color'
        document.head.appendChild(navbarMeta)
      }
      navbarMeta.content = themeColor

      // Atualizar para PWA standalone
      if (window.matchMedia('(display-mode: standalone)').matches) {
        document.documentElement.style.setProperty('background-color', themeColor)
      }
    }

    // Também atualizar a cor de fundo do body durante transições
    document.documentElement.style.setProperty('--status-bar-color', themeColor)
  }, [pathname])

  return null
}
