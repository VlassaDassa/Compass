FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY build.mjs ./
COPY src ./src
COPY dist ./dist
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4180 NODE_EXTRA_CA_CERTS=/app/certs/russian-trusted-ca.pem
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server.mjs package.json ./
COPY --chown=node:node docs/runtime-schema.sql ./docs/runtime-schema.sql
COPY --chown=node:node certs/russian-trusted-ca.pem ./certs/russian-trusted-ca.pem
USER node
EXPOSE 4180
CMD ["node", "server.mjs"]
