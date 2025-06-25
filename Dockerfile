FROM node:20

WORKDIR /app

# Set memory limit
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Copy everything
COPY . .

# Optional: upgrade npm
RUN npm install -g npm@latest

# Install deps
RUN npm install --legacy-peer-deps

# Optional: build step
RUN npm run build || true

# Expose port
EXPOSE 9000

# Run with local CLI
CMD ["npm", "run", "start"]
