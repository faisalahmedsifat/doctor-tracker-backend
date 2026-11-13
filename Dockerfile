# Pin the runtime and package manager so Railway builds are reproducible.
FROM node:22.23.4-bookworm-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.4.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:22.23.4-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
