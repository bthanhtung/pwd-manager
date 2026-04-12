#!/bin/bash
echo "Generating secure keys for .env..."
echo "SERVER_ENCRYPTION_KEY: $(openssl rand -hex 16)"
echo "JWT_SECRET: $(openssl rand -base64 32)"