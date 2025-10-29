FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/subscription-service/package.json ./apps/subscription-service/
COPY libs/*/package.json ./libs/*/

RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate --schema=./apps/subscription-service/prisma/schema.prisma

RUN npx nx build subscription-service --prod

FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate
WORKDIR /app

COPY --from=build /app/dist/apps/subscription-service ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/subscription-service/prisma ./prisma
COPY package.json pnpm-lock.yaml ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node main.js"]

