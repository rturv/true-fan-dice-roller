#!/bin/sh
set -e

# =============================================================================
# Runtime environment variable injection
#
# Reads env.template.js (with ${VAR} placeholders), substitutes real values
# from environment variables, and writes the result as env.js
# =============================================================================

ENV_TEMPLATE="/usr/share/nginx/html/assets/env.template.js"
ENV_FILE="/usr/share/nginx/html/assets/env.js"

if [ -f "$ENV_TEMPLATE" ]; then
  echo "Generating runtime environment config..."

  # Export default values so envsubst doesn't leave blank placeholders
  export BACKEND_WS_URL="${BACKEND_WS_URL:-}"
  export BACKEND_HTTP_URL="${BACKEND_HTTP_URL:-}"

  # Substitute environment variables in the template
  envsubst '${BACKEND_WS_URL} ${BACKEND_HTTP_URL}' < "$ENV_TEMPLATE" > "$ENV_FILE"

  echo "Runtime environment config written to $ENV_FILE"
else
  echo "Warning: $ENV_TEMPLATE not found, skipping env config"
fi

# Execute the main command (nginx)
exec "$@"
