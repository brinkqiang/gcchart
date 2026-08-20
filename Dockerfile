# Pin to a minor release for reproducible builds.
FROM node:20.11-alpine AS build

WORKDIR /app

# Copy lockfile so `npm ci` produces a deterministic install.
COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
RUN npm ci --no-audit --no-fund

COPY src ./src
RUN npm run build

# --- Production stage ---
FROM node:20.11-alpine

# Need git for committing the output back to the user's repo.
RUN apk add --no-cache git

WORKDIR /app

COPY package.json package-lock.json ./
# Reinstall without dev dependencies to keep the image lean.
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist

ENTRYPOINT ["node", "/app/dist/action.js"]
