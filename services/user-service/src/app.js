const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Security middleware
app.use(helmet());
app.use(cors());

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Hello World endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Hello World from User Service!',
        service: 'user-service',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint (matches your FastAPI pattern)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'user-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Basic user endpoints
app.get('/api/users', (req, res) => {
    res.json({
        message: 'Get all users endpoint',
        users: []
    });
});

app.post('/api/users', (req, res) => {
    res.status(201).json({
        message: 'Create user endpoint',
        data: req.body
    });
});

app.get('/api/users/:id', (req, res) => {
    res.json({
        message: `Get user ${req.params.id}`,
        userId: req.params.id
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    // Log error to file
    const errorLog = `${new Date().toISOString()} - Error: ${err.stack}\n`;
    fs.appendFileSync(path.join(logsDir, 'error.log'), errorLog);
    
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 User service running on port ${PORT}`);
    console.log(`📊 Health check available at http://localhost:${PORT}/health`);
    console.log(`👋 Hello World at http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

module.exports = app;