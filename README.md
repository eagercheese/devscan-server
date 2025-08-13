# DevScan Server

A backend server for the DevScan browser extension that provides URL scanning and threat detection capabilities.

## 🚀 Features

- **URL Scanning**: Analyze URLs for potential security threats
- **Threat Detection**: Identify malicious links and suspicious content
- **Caching System**: Efficient caching for improved performance
- **Machine Learning**: ML-powered threat analysis
- **Whitelist Management**: Manage trusted domains and URLs
- **Session Management**: Track and manage scan sessions
- **RESTful API**: Clean API endpoints for browser extension integration

## 📁 Project Structure

```
├── src/
│   ├── app.js                 # Main Express application
│   ├── controllers/           # Request handlers
│   │   ├── extensionController.js
│   │   ├── scanEngineController.js
│   │   ├── scanLinksController.js
│   │   ├── scannedLinkController.js
│   │   ├── scanResultsController.js
│   │   └── scanSessionController.js
│   ├── models/                # Database models
│   │   ├── Admin.js
│   │   ├── CachedResults.js
│   │   ├── ScanEngine.js
│   │   ├── ScannedLink.js
│   │   ├── ScanResults.js
│   │   ├── ScanSession.js
│   │   ├── ThreatFeedList.js
│   │   └── index.js
│   ├── routes/                # API route definitions
│   └── services/              # Business logic services
│       ├── cacheService.js
│       ├── mlService.js
│       └── whitelistService.js
├── start-server.js            # Server startup script
└── package.json
```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/eagercheese/devscan-server.git
   cd devscan-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory with your configuration:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=devscan_db
   ML_SERVICE_URL=http://localhost:3001/analyze
   ```

4. **Database Setup**
   Make sure you have MySQL running and create the database:
   ```sql
   CREATE DATABASE devscan_db;
   ```

## 🚀 Usage

### Development Mode
```bash
npm run dev
```
This starts the server with nodemon for automatic restarts on file changes.

### Production Mode
```bash
npm start
```

### Testing
```bash
npm test
```

## 📡 API Endpoints

### Health Check
- **GET** `/health` - Server status check

### Scan Operations
- **POST** `/api/scan` - Submit URL for scanning
- **GET** `/api/scan/:id` - Get scan results
- **GET** `/api/scans` - List all scans

### Session Management
- **POST** `/api/sessions` - Create new scan session
- **GET** `/api/sessions/:id` - Get session details

### Results
- **GET** `/api/results` - Get scan results
- **GET** `/api/results/:id` - Get specific result

## 🔧 Configuration

The server uses the following technologies:

- **Express.js** - Web framework
- **Sequelize** - ORM for MySQL
- **MySQL2** - Database driver
- **Axios** - HTTP client for external API calls
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## 🧪 Testing

The project includes comprehensive testing with:

- **Jest** - Testing framework
- **Supertest** - HTTP assertion library
- **Nock** - HTTP mocking library

Test files:
- `test-high-rank-domains.js`
- `test-tranco-filtering.js`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🔗 Related Projects

- [DevScan Browser Extension](https://github.com/eagercheese/devscan-extension) - The browser extension that connects to this server

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub.
