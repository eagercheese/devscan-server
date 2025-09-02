# DevScan Database Setup

SQL commands to create the database and tables for the DevScan server.

## Create Database

```sql
CREATE DATABASE DevScanDB;
USE DevScanDB;
```

## Create Tables

### 1. ScanEngine
```sql
CREATE TABLE ScanEngine (
    engineVersion VARCHAR(255) PRIMARY KEY NOT NULL
) ENGINE=InnoDB;
```

### 2. ScanSession
```sql
CREATE TABLE ScanSession (
    session_ID INT PRIMARY KEY AUTO_INCREMENT,
    browserInfo VARCHAR(255),
    timestamp DATETIME,
    engineVersion VARCHAR(255),
    FOREIGN KEY (engineVersion) REFERENCES ScanEngine(engineVersion)
) ENGINE=InnoDB;
```

### 3. ScannedLink
```sql
CREATE TABLE ScannedLink (
    link_ID INT PRIMARY KEY AUTO_INCREMENT,
    session_ID INT,
    scanTimestamp DATETIME,
    url TEXT,
    FOREIGN KEY (session_ID) REFERENCES ScanSession(session_ID)
) ENGINE=InnoDB;
```

### 4. ScanResults
```sql
CREATE TABLE ScanResults (
    result_ID INT PRIMARY KEY AUTO_INCREMENT,
    final_verdict VARCHAR(32),
    confidence_score VARCHAR(16),
    anomaly_risk_level VARCHAR(16),
    explanation TEXT,
    tip TEXT,
    link_ID INT,
    session_ID INT,
    FOREIGN KEY (link_ID) REFERENCES ScannedLink(link_ID),
    FOREIGN KEY (session_ID) REFERENCES ScanSession(session_ID)
) ENGINE=InnoDB;
```

### 5. CachedResults
```sql
CREATE TABLE cached_results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    results_ID INT,
    link_ID INT,
    final_verdict VARCHAR(32),
    confidence_score VARCHAR(16),
    anomaly_risk_level VARCHAR(16),
    explanation TEXT,
    tip TEXT,
    cacheSource VARCHAR(32) DEFAULT 'ml_service',
    lastScanned DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiresAt DATETIME,
    FOREIGN KEY (results_ID) REFERENCES ScanResults(result_ID),
    FOREIGN KEY (link_ID) REFERENCES ScannedLink(link_ID)
) ENGINE=InnoDB;
```

## Setup Instructions

1. Run MySQL server
2. Execute the SQL commands above in order
3. Start the DevScan server with `npm start`
4. Sequelize will handle any additional setup automatically
