FROM node:24-slim

# Prisma needs openssl, and the node image doesn't ship pnpm
RUN apt-get update -y && apt-get install -y openssl
RUN corepack enable

WORKDIR /app

# Install packages first (cached until package.json or the lockfile changes)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# Copy the code and compile it
COPY . .
RUN pnpm build

ENV PORT=5001
EXPOSE 5001

CMD ["pnpm", "dev"]
