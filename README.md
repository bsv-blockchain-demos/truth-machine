# Truth Machine

A blockchain-based data integrity and timestamping system built on Bitcoin SV. Truth Machine provides immutable proof of data existence and integrity by recording cryptographic hashes on the blockchain.

## Features

- **Secure File Storage**: Upload files with blockchain-backed integrity verification
- **Timestamping**: Immutable proof of data existence at a specific time
- **Integrity Verification**: Download files with cryptographic proof of integrity
- **BEEF Integration**: Background Evaluation Extended Format for complete transaction verification
- **Treasury Management**: Built-in token system for managing transaction fees
- **QR Code Support**: Easy funding through QR code scanning
- **Modern Web Interface**: User-friendly React-based frontend

## System Architecture

### Frontend (React + TypeScript)
- Modern React application with TypeScript
- Real-time treasury balance monitoring
- Intuitive file upload/download interface
- QR code generation for funding

### Backend (Node.js + Express)
- RESTful API endpoints for file operations
- BEEF transaction format support
- Blockchain integration via WhatsOnChain
- MongoDB for file and transaction storage

## Quick Start

Prerequisites are the latest versions of docker compose and node.js - start.sh script assumes a macOS / unix starting point.     

Clone the repository, and run the quickstart script:
```bash
git clone https://github.com/bitcoin-sv/truth-machine.git
cd truth-machine
sh quickstart.sh
```

This will navigate to front and back installing deps and creating local keys, adding them to the .env and your docker-compose.yml before launching it.

One thing which you may want to manually update is a reverse proxy to send your API at port 3030 the ARC callbacks. For this we recommend running ngrok locally and updating the DOMAIN env variable in the docker-compose.yml to the URL that will generate.

Run 
```bash
ngrok http 3030
```

Then copy paste the public domain that attaches to into the .env or docker-compose.yml - whichever you're running.

Stop the services with [ Ctrl ] + [ C ] or
```bash
docker compose down
```

Whenever you want to restart the services without destroying your env post setup, just run this instead:

```bash
docker compose up
```

## Running the Application

### Development Mode

1. Start the backend:
```bash
cd back
npm run dev
```

2. Start the frontend:
```bash
cd front
npm run dev
```

### Production Mode

1. Build and start the backend:
```bash
cd back
npm run build
npm run start
```

2. Build and serve the frontend:
```bash
cd front
npm run build
npm run preview
```

### Docker

Build the images locally:
```bash
docker compose build
```

Run the containers:
```bash
docker compose up
```

## Usage Guide

### 1. Treasury Management
- Access the Treasury section to view current balance
- Scan the QR code to fund the treasury with BSV
- Create write tokens for file uploads (1 token per upload)

### 2. File Upload
1. Navigate to the Upload section
2. Select a file to upload
3. System will:
   - Calculate file hash
   - Create blockchain transaction
   - Store file securely
   - Return transaction ID and proof

### 3. File Download
1. Navigate to the Download section
2. Enter the file hash or transaction ID
3. Receive:
   - Original file
   - Timestamp proof
   - Integrity verification
   - BEEF transaction data

## API Endpoints

### File Operations
- `POST /api/upload` - Upload and timestamp file
- `GET /api/download/:hash` - Download file with proofs
- `GET /api/verify/:hash` - Verify file integrity

### Treasury Management
- `GET /api/checkTreasury` - Get treasury status
- `POST /api/fund/:tokens` - Create write tokens

## Security Features

- **BEEF Format**: Complete transaction verification
- **SPV Proofs**: Simplified Payment Verification
- **Hash Verification**: SHA-256 file integrity checking
- **Immutable Timestamping**: Blockchain-backed time proofs

## Development

### Prerequisites
- Node.js 18+
- MongoDB 4.4+
- BSV wallet for testing

### Testing
```bash
# Run backend tests
cd back
npm test

# Run frontend tests
cd front
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- GitHub Issues: [Create an issue](https://github.com/bitcoin-sv/truth-machine/issues)
- Documentation: [Wiki](https://github.com/bitcoin-sv/truth-machine/wiki)

## Acknowledgments

- Bitcoin SV community
- WhatsOnChain API
- BEEF specification contributors
