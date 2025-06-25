FROM node:20

WORKDIR /app

COPY . .

ENV NODE_OPTIONS="--max-old-space-size=1024"

# Ensure latest npm is available
RUN npm install -g npm@latest

# Install dependencies including CLI (important!)
RUN npm install --legacy-peer-deps

# Build the app (optional depending on your build step)
RUN npm run build

EXPOSE 9000

# Start using locally installed CLI from node_modules/.bin
CMD ["npx", "medusa", "start"]
