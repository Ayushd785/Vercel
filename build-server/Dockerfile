FROM ubuntu:focal

# Install curl & git
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 (instead of 18)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest

# Set working directory
WORKDIR /home/app

# Copy required files
COPY main.sh script.js package*.json ./

# Install project dependencies
RUN npm install

# Make scripts executable
RUN chmod +x main.sh script.js

# Start script
ENTRYPOINT ["/home/app/main.sh"]
