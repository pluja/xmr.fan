FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# The scheduled jobs (ops/job.sh) run in this image with the repository mounted at /app.
FROM node:22-alpine AS jobs
RUN apk add --no-cache ffmpeg
ENV HOME=/tmp
WORKDIR /app

FROM node:22-alpine AS app
RUN apk add --no-cache tini
WORKDIR /app
ENV HOST=0.0.0.0 PORT=4321 NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
RUN mkdir sponsor-requests && chown node sponsor-requests
VOLUME /app/sponsor-requests
EXPOSE 4321
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server/entry.mjs"]
