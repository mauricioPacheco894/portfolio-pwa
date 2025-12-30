# Portfolio PWA 📊

Aplicación web progresiva para gestionar y monitorear portafolios de inversión en tiempo real.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-green?style=flat&logo=supabase)

## 🎯 Sobre el Proyecto

Portfolio PWA es una aplicación web progresiva completa que demuestra la implementación de las mejores prácticas en desarrollo web moderno. El proyecto permite gestionar múltiples portafolios de inversión con seguimiento en tiempo real de precios, análisis de rendimiento y sugerencias de rebalanceo.

## ✨ Características Principales

- 📱 **Progressive Web App** - Instalable como app nativa en cualquier dispositivo
- 📊 **Datos en Tiempo Real** - Integración con Yahoo Finance para precios actualizados
- 💼 **Gestión Multi-Portafolio** - Organiza múltiples portafolios simultáneamente
- 🎯 **Rebalanceo Inteligente** - Algoritmo que sugiere operaciones basadas en tu asignación objetivo
- 📈 **Visualización Interactiva** - Gráficos dinámicos de distribución y performance
- 🌙 **Dark Mode** - Tema oscuro con persistencia de preferencias
- 🔐 **Autenticación Segura** - Sistema completo de auth con Supabase
- ⚡ **Performance Optimizada** - Caching inteligente, code splitting y lazy loading

## �️ Stack Tecnológico

### Frontend

- **Next.js 16** - App Router, Server Components, Streaming
- **TypeScript** - Type-safe con validación de schemas (Zod)
- **Tailwind CSS** - Utility-first styling con dark mode
- **React Query** - Server state management y caching

### Backend & Infraestructura

- **Supabase** - PostgreSQL, Auth, Row Level Security
- **Yahoo Finance API** - Datos de mercado en tiempo real
- **Vercel** - Deployment con edge functions

### Herramientas

- **next-pwa** - Service Worker y manifest
- **Recharts** - Visualización de datos
- **React Hot Toast** - Sistema de notificaciones
- **Lucide React** - Iconografía

## 🏗️ Arquitectura

El proyecto implementa:

- ✅ **PWA completa** con Service Worker y manifest
- ✅ **Middleware de autenticación** para protección de rutas
- ✅ **Error Boundaries** para manejo robusto de errores
- ✅ **React Query** para caching y sincronización de estado servidor
- ✅ **Code Splitting** con dynamic imports y lazy loading
- ✅ **Type-safe environment variables** con validación en build-time
- ✅ **SEO optimizado** con metadata dinámica

## 📦 Desarrollo

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm start        # Servidor de producción
npm run lint     # Linter ESLint
```

## � Deployment

Desplegado en **Vercel** con integración continua desde GitHub.

## 👤 Autor

**Mauricio Jesús Pacheco Mijangos**

- GitHub: [@mauricioPacheco894](https://github.com/mauricioPacheco894)
- Proyecto: [portfolio-pwa](https://github.com/mauricioPacheco894/portfolio-pwa)

## 📄 Licencia

MIT License
