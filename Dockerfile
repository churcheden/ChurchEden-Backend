# ---------- Build stage ----------
FROM node:24-alpine AS builder
WORKDIR /app

# Copy Prisma schema + config before npm ci so the postinstall (prisma generate) can run.
# prisma.config.ts reads DATABASE_URL via dotenv; provide a placeholder for codegen (no real connection needed).
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/dev
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# Compile TypeScript to ./dist
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- Runtime stage ----------
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy installed node_modules (includes generated Prisma client) and build output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/server.js"]
