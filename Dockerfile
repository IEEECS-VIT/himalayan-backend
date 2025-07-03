FROM node:20

WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the source code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=1024

# Expose Medusa port
EXPOSE 9000

# Start Medusa server
CMD ["npm", "run", "start"]









