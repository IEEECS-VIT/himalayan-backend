FROM node:20
WORKDIR /app
COPY . .
RUN npm install -g pnpm
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN pnpm install