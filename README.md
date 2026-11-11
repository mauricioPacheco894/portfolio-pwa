# Portfolio PWA 📊

Progressive web app to manage and monitor investment portfolios in real time.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-green?style=flat&logo=supabase)

## 🎯 About the Project

Portfolio PWA is a complete progressive web app showcasing modern web development best practices. The project lets you manage multiple investment portfolios with real-time price tracking, performance analysis and rebalancing suggestions.

## ✨ Key Features

- 📱 **Progressive Web App** - Installable as a native app on any device
- 📊 **Real-Time Data** - Yahoo Finance integration for up-to-date prices
- 💼 **Multi-Portfolio Management** - Organize multiple portfolios at the same time
- 🎯 **Smart Rebalancing** - Algorithm that suggests trades based on your target allocation
- 📈 **Interactive Visualization** - Dynamic distribution and performance charts
- 🌙 **Dark Mode** - Dark theme with persisted preferences
- 🔐 **Secure Authentication** - Complete auth system with Supabase
- ⚡ **Optimized Performance** - Smart caching, code splitting and lazy loading

## 🛠️ Tech Stack

### Frontend

- **Next.js 16** - App Router, Server Components, Streaming
- **TypeScript** - Type-safe with schema validation (Zod)
- **Tailwind CSS** - Utility-first styling with dark mode
- **React Query** - Server state management and caching

### Backend & Infrastructure

- **Supabase** - PostgreSQL, Auth, Row Level Security
- **Yahoo Finance API** - Real-time market data
- **Vercel** - Deployment with edge functions

### Tools

- **next-pwa** - Service Worker and manifest
- **Recharts** - Data visualization
- **React Hot Toast** - Notification system
- **Lucide React** - Icons

## 🏗️ Architecture

The project implements:

- ✅ **Full PWA** with Service Worker and manifest
- ✅ **Auth middleware** for route protection
- ✅ **Error Boundaries** for robust error handling
- ✅ **React Query** for server-state caching and synchronization
- ✅ **Code Splitting** with dynamic imports and lazy loading
- ✅ **Type-safe environment variables** with build-time validation
- ✅ **Optimized SEO** with dynamic metadata

## 📦 Development

```bash
npm run dev      # Development server
npm run build    # Production build
npm start        # Production server
npm run lint     # ESLint linter
```

## 🚀 Deployment

Deployed on **Vercel** with continuous integration from GitHub.

## 👤 Author

**Mauricio Jesús Pacheco Mijangos**

- GitHub: [@mauricioPacheco894](https://github.com/mauricioPacheco894)
- Project: [portfolio-pwa](https://github.com/mauricioPacheco894/portfolio-pwa)

## 📄 License

MIT License
