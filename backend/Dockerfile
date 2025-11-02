# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/index.js"]
