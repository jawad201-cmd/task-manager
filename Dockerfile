# ─────────────────────────────────────────────────────────────
# Dockerfile — Task Manager (Node.js + Express)
# ─────────────────────────────────────────────────────────────

# Use official Node.js LTS image on Alpine (minimal footprint)
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy only dependency manifests first (leverages Docker layer cache)
# If package.json hasn't changed, npm install won't re-run on rebuilds
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the rest of the application source code
COPY . .

# Expose the port the app listens on
EXPOSE 3000

# Start the application
CMD ["node", "app.js"]
