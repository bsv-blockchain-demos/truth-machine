#!/bin/bash
set -e

# Install backend dependencies and configure backend
echo "Installing backend dependencies..."
cd back
npm install
npm i -g @bsv/sdk

echo "Generating Bitcoin WIF..."
wif=$(node <<'EOF'
const { PrivateKey } = require('@bsv/sdk');

// Generate a new random private key
const privateKey = PrivateKey.fromRandom();

// Print the Wallet Import Format (WIF) of the private key
console.log(privateKey.toWif());
EOF
)

echo "Generated Private Key: $wif"

mkdir -p .wifs
timestamp=$(date +%Y%m%d%H%M%S)
echo "$wif" > ".wifs/private_wif_${timestamp}.txt"

echo "Generating SHA256 hash of the WIF..."
callback=$(echo -n "$wif" | sha256sum | awk '{print $1}')
echo "Generated SHA256 Token: $callback"

echo "Creating .env file in back directory..."
cat <<EOF > .env
PORT=3030
FUNDING_WIF=$wif
MONGO_URI=mongodb://localhost:27017 # this will work if you're running a mongodb community service locally, otherwise use a remote connection string
DOMAIN=<your-domain.com> # where you'll receive callbacks with merkle paths from ARC
CALLBACK_TOKEN=$callback # to make sure you don't accept callbacks from abyone else
NETWORK=test # test | main
DB_NAME=truth-machine
EOF

echo "Updating FUNDING_WIF in docker-compose.yml..."
sed -i '' "s|FUNDING_WIF:.*|FUNDING_WIF: \"${wif}\"|" ../docker-compose.yml

cd ..

# Install frontend dependencies and configure frontend
echo "Installing frontend dependencies..."
cd front
npm install

echo "Creating .env file in front directory..."
cat <<EOF > .env
API_URL=localhost:3030 # update this if you're running the api on some domain
EOF

cd ..

# Run the demo
echo "Building Docker images..."
docker compose build

echo "Starting Docker containers..."
docker compose up