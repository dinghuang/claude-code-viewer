#!/bin/bash
# Generate self-signed certificates for local HTTPS development
# Usage: cd certs && bash generate-certs.sh

set -e

CERTS_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$CERTS_DIR"

echo "==> Generating local CA..."
openssl genrsa -out ca.key 2048
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt \
  -subj "/C=CN/ST=Local/L=Local/O=DevCA/CN=Local Dev CA"

echo "==> Generating server certificate..."
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr \
  -subj "/C=CN/ST=Local/L=Local/O=Dev/CN=localhost"

cat > server-ext.cnf <<EOF
authorityKeyIdentifier=keyIdentifier,issuer
basicConstraints=CA:FALSE
keyUsage=digitalSignature,nonRepudiation,keyEncipherment,dataEncipherment
subjectAltName=@alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = backend
DNS.3 = runtime
DNS.4 = frontend
DNS.5 = *.localhost
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
EOF

openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out server.crt -days 3650 \
  -extfile server-ext.cnf

rm -f server.csr server-ext.cnf ca.srl

echo ""
echo "==> Certificates generated in: $CERTS_DIR"
echo "    ca.crt      - Import this into your browser to trust the certificates"
echo "    server.crt   - Server certificate (used by all services)"
echo "    server.key   - Server private key"
echo ""
echo "To trust in macOS:  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ca.crt"
echo "To trust in Windows: certutil -addstore -f \"ROOT\" ca.crt"
