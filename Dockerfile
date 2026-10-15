# Dockerfile for MediSales API
# Use Node.js 20 Alpine as a small base image
FROM node:20-alpine

# Create app and data directories with proper permissions
RUN mkdir -p /app && chown -R node:node /app
RUN mkdir -p /data && chown -R node:node /data

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables with defaults (can be overridden at runtime)
ENV NODE_ENV=production \
    DATABASE_PATH=/data/medical.db \
    HOST=0.0.0.0 \
    PORT=3000

# Use the non-root node user from the base image
USER node

# Start the application
CMD ["npm start"]