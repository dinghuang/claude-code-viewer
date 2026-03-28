FROM python:3.12-slim

# Install Node.js 20 (required for Claude Code CLI)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg git \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/
COPY system_prompt.md .
COPY user_info.md .

# Default environment
ENV HOST=0.0.0.0
ENV PORT=8000
ENV WORKING_DIRECTORY=/workspace

EXPOSE 8000

CMD ["python", "-m", "app.main"]
