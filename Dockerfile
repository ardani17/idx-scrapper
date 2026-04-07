# Stage 1: Dependencies
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Playwright
FROM oven/bun:1 AS playwright
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libxshmfence1 libx11-xcb1 libxfixes3 libxkbcommon0 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
RUN bunx playwright install chromium

# Stage 3: Runtime
FROM oven/bun:1 AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libxshmfence1 libx11-xcb1 libxfixes3 libxkbcommon0 \
    fonts-liberation curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=playwright /root/.cache/ms-playwright /root/.cache/ms-playwright
COPY package.json tsconfig.json ./
COPY src/ src/

RUN mkdir -p /app/data/disclosures /app/data/api-keys

ENV PORT=3100
ENV NODE_ENV=production

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3100/api/health || exit 1

CMD ["bun", "--bun", "run", "src/index.ts"]
