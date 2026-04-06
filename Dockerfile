FROM oven/bun:1

WORKDIR /app

# Install Chromium dependencies + Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libxshmfence1 libx11-xcb1 libxfixes3 libxkbcommon0 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
RUN bunx playwright install chromium

COPY tsconfig.json ./
COPY src/ src/

RUN mkdir -p /app/data/disclosures /app/data/api-keys

ENV PORT=3100
ENV NODE_ENV=production

EXPOSE 3100

CMD ["bun", "--bun", "run", "src/index.ts"]
