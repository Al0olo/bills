FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/payment-service/package.json ./apps/payment-service/
COPY libs/*/package.json ./libs/*/

RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate --schema=./apps/payment-service/prisma/schema.prisma

RUN npx nx build payment-service --prod

FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate
WORKDIR /app

COPY --from=build /app/dist/apps/payment-service ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/payment-service/prisma ./prisma
COPY package.json pnpm-lock.yaml ./

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node main.js"]

