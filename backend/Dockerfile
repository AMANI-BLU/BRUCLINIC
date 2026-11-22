FROM node:22-alpine AS runner

WORKDIR /app

# Install security updates
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# Copy package definitions
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Run as non-root user for security
USER node

EXPOSE 4000

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000

CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]
