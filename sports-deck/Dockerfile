FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
# Allow passing a DATABASE_URL at build time to satisfy Prisma config
ARG DATABASE_URL="postgresql://postgres:postgres@db:5432/sports_deck_build?schema=public"
ENV DATABASE_URL=$DATABASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
## Generate Prisma client (uses build-time DATABASE_URL arg)
RUN npx prisma generate
## Build Next.js production assets
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache postgresql
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/scripts ./scripts
EXPOSE 3000
## Copy container entrypoint
CMD ["npm", "run", "start"]
