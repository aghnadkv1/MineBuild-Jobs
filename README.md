# MineBuild Jobs

MineBuild Jobs is a Next.js App Router application with a PostgreSQL backend using Drizzle ORM and Better Auth.

## Local setup

1. Create `.env.local` in the project root with local-only values (generate fresh random values; do not commit this file):

   ```bash
   node -e "const c=require('crypto'); console.log('BETTER_AUTH_SECRET='+c.randomBytes(32).toString('base64')); console.log('POSTGRES_PASSWORD='+c.randomBytes(24).toString('hex'))"
   ```

   Set `BETTER_AUTH_URL=http://localhost:3000`, `POSTGRES_PASSWORD` to the generated password, and `DATABASE_URL=postgresql://minebuild:<POSTGRES_PASSWORD>@localhost:5432/minebuild`.
2. Install and start Docker Desktop with the WSL 2 backend enabled. If Docker reports that WSL is missing, install WSL 2 from an elevated terminal (`wsl --install --no-distribution`) and restart Windows when prompted. Hardware virtualization must be enabled in BIOS/UEFI. Then start PostgreSQL:

   ```bash
   docker compose --env-file .env.local up -d db
   ```

3. Apply the PostgreSQL schema:

   ```bash
   npm run db:migrate
   ```

4. Start or restart the app with `npm run dev`.

Drizzle Kit loads `.env.local` through Next's environment loader. `GET /api/health` checks database connectivity. The Compose database persists in the `minebuild-postgres-data` volume. Stop the container with `docker compose --env-file .env.local down`; adding `-v` removes the database volume and permanently deletes its data.

## External job sources

External job discovery is read-only. MineBuild can import Minecraft-related listings from Upwork's [official GraphQL API](https://www.upwork.com/developer/documentation/graphql/api/docs/index.html), using its documented `marketplaceJobPostingsSearch` operation. It never applies, sends proposals or messages, accepts projects, or makes payments on an external platform. Builders must review the original listing and initiate any external action themselves. Proposal drafts can be prepared in MineBuild, but the in-app send endpoint rejects external-source jobs.

1. Create an Upwork OAuth 2.0 application with the official **Read marketplace Job Postings** permission and register this callback URL: `http://localhost:3000/api/integrations/upwork/callback`.
2. Add these values to the local `.env.local` file. Keep the client secret private; never put OAuth credentials in browser code or chat:

   ```dotenv
   UPWORK_CLIENT_ID=
   UPWORK_CLIENT_SECRET=
   UPWORK_REDIRECT_URI=http://localhost:3000/api/integrations/upwork/callback
   ```

3. Sign in with an administrator account, choose **Hubungkan Upwork**, and approve access on Upwork. MineBuild uses OAuth 2.0 Authorization Code with PKCE; access and refresh tokens are encrypted in PostgreSQL using a key derived from `BETTER_AUTH_SECRET`.
4. Choose **Sinkronkan Upwork** to run the documented `marketplaceJobPostingsSearch` query (up to five pages of 50 records). Only relevant Minecraft opportunities are normalized and imported. Duplicates are prevented using the source/external ID, canonical source URL, and content fingerprint.

Upwork listings can be displayed and opened for manual review, but they are excluded from builder-profile matching and ranking. The match API rejects attempts to calculate profile scores for Upwork listings.

Set the same environment variables in the deployment environment. Use an HTTPS callback URI outside local development. If `BETTER_AUTH_SECRET` changes, reconnect Upwork because the stored tokens can no longer be decrypted.
Only an existing trusted account explicitly assigned the `admin` role can connect a source or start a sync; public registration cannot create administrator accounts. To designate the trusted local administrator after registering, update that account directly in PostgreSQL with `UPDATE "user" SET role = 'admin' WHERE email = 'trusted-admin@example.com';`. For a hosted deployment, use the provider's database console and the same statement with the trusted administrator's email.

The Upwork GraphQL adapter remains in `lib/integrations/job-sources.ts`. Fiverr has its own adapter module in `lib/integrations/fiverr.ts`. Both implement the provider-independent contract in `lib/integrations/job-source-contract.ts` and normalize into the shared Job model. Fiverr intentionally returns an explicit not-configured error until its official API documentation and response format are supplied; no endpoint or response format is guessed, and neither platform is scraped.

## Authentication

Better Auth email/password endpoints are mounted at `/api/auth/*`. Email/password accounts require a password with at least 12 characters. Registration may set `role` to `builder` or `client`; `admin` cannot be assigned during registration. Email verification, outbound email delivery, and password-recovery delivery need a mail provider and are not configured. Store a long, random `BETTER_AUTH_SECRET` outside source control.

Auth sessions are stored in PostgreSQL and use secure cookies in production. The API checks the current session for private data and mutations.

## API

JSON responses use `{ "data": ... }` on success and `{ "error": { "code": "...", "message": "..." } }` on failure. Private routes require a Better Auth session cookie.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/jobs` | Public job search/filter; supports `q`, `category`, `version`, `skill`, `complexity`, `deadlineBefore`, `budgetMin`, `budgetMax`, `source` (`minebuild`, `upwork`, `fiverr`), `status`, `sort`, `limit`, and `offset`. Sort values: `newest`, `oldest`, `budget_high`, `budget_low`, `deadline`; `match` requires a signed-in builder profile. |
| POST | `/api/jobs` | Client/admin creates a job. |
| GET | `/api/jobs/:jobId` | Job detail. |
| GET | `/api/integrations/upwork/connect` | Admin-only Upwork OAuth 2.0 authorization using PKCE. |
| GET | `/api/integrations/upwork/callback` | Admin-only OAuth callback; tokens are encrypted before storage. |
| POST | `/api/integrations/jobs/sync?source=upwork` | Admin-only, read-only Upwork discovery and import. `source=fiverr` returns an explicit not-configured response until its official API docs are available. |
| POST / DELETE | `/api/jobs/:jobId/save` | Save or unsave a job for the signed-in user. |
| GET | `/api/saved-jobs` | Current user's saved jobs. |
| GET / PATCH / POST | `/api/profile/me` | Read/update own builder profile or add a portfolio project. |
| PATCH / DELETE | `/api/profile/me/portfolio/:projectId` | Edit/delete an owned portfolio project. |
| GET | `/api/profiles/:userId` | Read a public builder profile and public portfolio items. |
| POST | `/api/matches/:jobId` | Calculate and persist an explainable deterministic match score. This does not call an external AI provider. |
| GET | `/api/matches` | Current user's saved match results. |
| GET / POST | `/api/proposals` | List own proposal drafts or create a draft. |
| PATCH | `/api/proposals/:proposalId` | Edit an owned draft only. |
| POST | `/api/proposals/:proposalId/send` | Explicitly send an owned draft as a chat message and notify the client. |
| GET / POST | `/api/conversations` | List conversations or start/reuse a conversation for a job. |
| GET / POST | `/api/conversations/:conversationId/messages` | Read/send messages as a conversation participant. |
| GET / PATCH | `/api/notifications` | List own notifications and mark selected/all as read. |

The match calculator is deterministic and based on profile/job overlap; it must not be presented as a generated AI assessment unless an AI provider is added. Proposals remain drafts until the explicit send endpoint is called. External listings cannot be sent through MineBuild and must be handled manually on their source platform. Payments, automatic external client contact, AI model calls, and file uploads are not configured.

## Frontend integration

The dashboard uses the same-origin API routes for job search and creation, saved jobs, builder profiles and portfolio, match calculations, proposals, conversations/messages, and notifications. Better Auth's React client manages the session, email/password sign-in, and sign-out; registration sends the selected `builder` or `client` role to the server's validated signup endpoint.

Most account actions require a configured PostgreSQL database and a signed-in account. The dashboard reports API errors when setup is incomplete. The match screen uses the backend's deterministic scoring and labels it accordingly; sending a proposal requires saving a draft first and explicitly confirming the send action.

## Database schema

The Drizzle schema is in `lib/db/schema.ts`. Generate migrations after schema changes using `npm run db:generate`, then apply checked-in migrations using `npm run db:migrate`. Inspect data locally with `npm run db:studio`.

For production, configure a managed PostgreSQL service and use TLS in `DATABASE_URL`. Never commit `.env.local` or production credentials.
