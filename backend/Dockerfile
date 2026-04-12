# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files để install dependencies trước (tận dụng Docker cache)
COPY package*.json ./
RUN npm install

# Copy toàn bộ source code và build
COPY . .
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Copy các file cần thiết từ stage builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Biến môi trường mặc định
ENV NODE_ENV=production

# Mở cổng 3000
EXPOSE 3000

CMD ["node", "dist/main"]