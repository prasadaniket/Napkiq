# Tech Stack

## Overview
StoneOven is a full-stack premium CMS and customer engagement platform. It uses a modern TypeScript-first approach across both the frontend and backend to ensure type safety and rapid development.

## Frontend (client/cms)
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **State & Logic**: React 19 (Server Components + Client Hooks)
- **Styling**: Vanilla CSS with CSS Variables for the premium dark theme. 
- **Authentication**: Supabase Auth (JWT via cookies)
- **API Client**: Axios with custom interceptors for token refresh
- **Form Handling**: React Hook Form with Zod validation
- **Date Management**: `date-fns` for formatted timelines and relative ages
- **UI Components**: Hand-crafted SVG-based icons and custom layouts (no generic UI libraries)

## Backend (server/)
- **Runtime**: Node.js (TypeScript)
- **Framework**: Express.js
- **Database / ORM**: PostgreSQL with Prisma
- **Authentication**: JWT (Supabase-compatible)
- **Security**: Role-based access control (RBAC) with hierarchical scoping (Admin > Owner > Franchise)
- **Validation**: Zod (shared or mirrored schemas)

## Infrastructure & Tools
- **Version Control**: Git
- **Package Management**: npm
- **Database Hosting**: Supabase (PostgreSQL)
- **Asset Management**: Cloudinary (Integration in progress)
- **Communications**: WhatsApp Cloud API (Planned for automation)
