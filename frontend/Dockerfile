# =============================================================================
# Stage 1: Build the Angular application
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install Angular CLI globally
RUN npm install -g @angular/cli@21

# Copy package files first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npx ng build --configuration production

# =============================================================================
# Stage 2: Serve with nginx
# =============================================================================
FROM nginx:1.27-alpine

# Install envsubst (included in nginx image via gettext)
RUN apk add --no-cache gettext

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built application
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html

# Copy runtime env template and entrypoint
COPY src/assets/env.template.js /usr/share/nginx/html/assets/env.template.js
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
