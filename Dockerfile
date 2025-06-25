# Use official Node.js LTS base image
FROM node:20

# Set working directory inside the container
WORKDIR /app

# Copy all files into the container
COPY . .

# Install dependencies using npm
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm install --omit=dev

# Build the Medusa backend
RUN npm run build

# Expose default Medusa port
EXPOSE 9000

# Start the Medusa server
CMD ["npm", "run", "start"]
