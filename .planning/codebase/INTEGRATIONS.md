# Integrations

## Core Services

### Supabase
- **Role**: Primary Auth and Database hosting.
- **Usage**: Handles JWT generation, user session management, and hosts the PostgreSQL instance driven by Prisma.
- **Pattern**: Client-side `cms_token` cookie is verified by Next.js middleware and Backend `requireAuth` middleware.

### Cloudinary (Active Integration)
- **Role**: Asset management and media delivery.
- **Usage**: Used for storing and serving outlet photos, customer profile images, and menu assets.
- **Implementation**: Secure server-side uploads via private API keys.

## Communication Channels

### WhatsApp Cloud API (Planned)
- **Role**: Automated customer engagement.
- **Usage**: Sending birthday greetings, anniversary wishes, and transaction receipts.
- **Pattern**: Webhook-driven status tracking for message delivery.

## Local Services

### Prisma ORM
- **Role**: Type-safe database client.
- **Usage**: Used in the `server/` to interact with PostgreSQL. Schema located in `server/prisma/schema.prisma`.
- **Convention**: Migrations managed via `npx prisma migrate`.
