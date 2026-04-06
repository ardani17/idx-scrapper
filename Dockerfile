FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ src/

RUN mkdir -p /app/data/disclosures /app/data/api-keys

ENV PORT=3100
ENV NODE_ENV=production

EXPOSE 3100

CMD ["bun", "--bun", "run", "src/index.ts"]
