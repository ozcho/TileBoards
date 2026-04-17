# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./public
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "src/index.js"]
