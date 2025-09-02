# DevScan Server

A backend server for the DevScan browser extension that provides URL scanning and threat detection capabilities with AI-powered machine learning analysis.

## 🚀 Features

- **URL Scanning**: Analyze URLs for potential security threats
- **AI-Powered Analysis**: Machine learning integration for advanced threat detection
- **Real-time Verdict System**: Instant security assessments with confidence scoring
- **User Control Modals**: Interactive popups for scanning states and user decision-making
- **Intelligent Caching**: Efficient caching system for improved performance and reduced API calls
- **Educational Tooltips**: Rich information display with ML analysis details
- **Session Management**: Track and manage scan sessions with browser metadata
- **RESTful API**: Clean API endpoints optimized for browser extension integration
- **Database Analytics**: Comprehensive query system for threat analysis and reporting

## 📁 Project Structure

```
├── src/
│   ├── app.js                 # Main Express application
│   ├── controllers/           # Request handlers
│   │   ├── extensionController.js      # Extension communication
│   │   ├── scanEngineController.js     # Scan engine management
│   │   ├── scanLinksController.js      # URL scanning operations
│   │   ├── scannedLinkController.js    # Scanned URL management
│   │   ├── scanResultsController.js    # Results processing
│   │   ├── scanSessionController.js    # Session handling
│   │   └── extractlinksController.js   # Link extraction
│   ├── models/                # Database models (Sequelize ORM)
│   │   ├── CachedResults.js            # ML analysis cache
│   │   ├── ScanEngine.js               # Engine versions
│   │   ├── ScannedLink.js              # URL records
│   │   ├── ScanResults.js              # Analysis results
│   │   ├── ScanSession.js              # Browser sessions
│   │   ├── ThreatFeedList.js           # Threat intelligence
│   │   └── index.js                    # Database connection
│   ├── routes/                # API route definitions
│   │   ├── extensionRoutes.js          # Extension API endpoints
│   │   ├── scanEngineRoutes.js         # Engine management routes
│   │   ├── scanLinksRoutes.js          # Scanning endpoints
│   │   └── [other route files]
│   └── services/              # Business logic services
│       ├── cacheService.js             # Cache management
│       ├── mlService.js                # ML integration
│       └── whitelistService.js         # Whitelist handling
├── start-server.js            # Server startup script
├── package.json              # Dependencies and scripts
├── README.md                 # Project documentation
└── DATABASE_QUERIES.md       # Complete database query reference
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
   DB_NAME=DevScanDB
   DB_PORT=3309
   ML_SERVICE_URL=You can request to the developer to use the ML
   ```

4. **Database Setup**
   Make sure you have MySQL running and create the database:
   ```sql
   CREATE DATABASE DevScanDB;
   ```
   
   The application will automatically create the required tables on first run using Sequelize migrations.

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

### Extension Integration
- **POST** `/api/extension/scan-links` - Submit multiple URLs for scanning
- **GET** `/api/extension/results/:sessionId` - Get scan results for session
- **POST** `/api/extension/cache-verdict` - Cache ML analysis results

### Scan Operations
- **POST** `/api/scan` - Submit single URL for scanning
- **GET** `/api/scan/:id` - Get specific scan results
- **GET** `/api/scans` - List all scans with filtering options

### Machine Learning Integration
- **POST** `/api/ml/analyze` - Send URL to ML service for analysis
- **GET** `/api/ml/cached/:url` - Get cached ML results for URL
- **POST** `/api/ml/cache` - Store ML analysis results

### Session Management
- **POST** `/api/sessions` - Create new scan session
- **GET** `/api/sessions/:id` - Get session details with scan history
- **GET** `/api/sessions` - List all sessions

### Results & Analytics
- **GET** `/api/results` - Get scan results with pagination
- **GET** `/api/results/:id` - Get specific result details
- **GET** `/api/analytics/threats` - Get threat statistics
- **GET** `/api/analytics/domains` - Get domain analysis data

## 🔧 Configuration

The server uses the following technologies:

- **Express.js** - Web framework for RESTful API
- **Sequelize** - ORM for MySQL database operations
- **MySQL2** - High-performance database driver
- **Axios** - HTTP client for ML service communication
- **CORS** - Cross-origin resource sharing middleware
- **dotenv** - Environment variable management
- **Node.js** - Runtime environment

### ML Service Integration
- **External ML API**: AWS-hosted machine learning service
- **Real-time Analysis**: Instant URL threat assessment
- **Caching Strategy**: 24-hour cache for ML results to optimize performance
- **Fallback Handling**: Graceful degradation when ML service is unavailable

### Database Configuration
- **Engine**: MySQL with Sequelize ORM
- **Connection Pooling**: Optimized for concurrent requests
- **Foreign Key Constraints**: Ensures data integrity
- **Indexing**: Performance-optimized for frequent queries

## 🧪 Testing

The project includes comprehensive testing with:

- **Jest** - Testing framework for unit and integration tests
- **Supertest** - HTTP assertion library for API testing
- **Nock** - HTTP mocking library for external service simulation

Test files:
- `test-high-rank-domains.js` - Domain ranking validation
- `test-tranco-filtering.js` - Tranco list filtering tests

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test test-high-rank-domains.js
```

## 🗄️ Database Documentation

For comprehensive database information including:
- Complete table schemas
- Common query examples
- ML integration queries
- Analytics and reporting queries
- Performance optimization tips

See: **[DATABASE_QUERIES.md](./DATABASE_QUERIES.md)**

## 🆕 Latest Updates

### Version 2.0 Features
- **Enhanced User Experience**: Interactive modals for scanning states
- **ML Integration**: Real-time machine learning threat analysis
- **Smart Caching**: Intelligent cache system with 24-hour expiration
- **Educational Content**: Rich tooltip information and security tips
- **Color-Coded UI**: Visual distinction between threat levels
- **Bypass Controls**: User control over scanning with security warnings
- **Performance Optimizations**: Database indexing and query optimization

### Browser Extension Features
- **Real-time Scanning**: Instant URL analysis on page load
- **Interactive Tooltips**: Hover information with detailed ML data
- **User Control Modals**: "Proceed Anyway" and "Proceed with Caution" options
- **Visual Indicators**: Color-coded risk levels and confidence scoring
- **Educational Sidebar**: Comprehensive threat information display

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
- [DevScan ML Service](You can request to the developer to use the ML) - AWS-hosted machine learning analysis service

## 📚 Documentation

- **[Database Setup](./DATABASE_SETUP.md)** - SQL commands to create the database tables

## 🚀 Deployment

### Production Environment
- **Server**: Node.js application
- **Database**: MySQL with optimized configuration
- **ML Service**: AWS-hosted external service
- **Caching**: In-database caching with automatic expiration

### Environment Variables (Production)
```env
NODE_ENV=production
PORT=3000
DB_HOST=your-production-db-host
DB_USER=your-production-db-user
DB_PASSWORD=your-secure-password
DB_NAME=DevScanDB
DB_PORT=3306
ML_SERVICE_URL=You can request to the developer to use the ML
```

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub.
