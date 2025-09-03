const express = require('express');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const cors = require('cors');
const responseHandler = require('./middlewares/handling');
const setupSwagger = require('./swagger');
const { connectToDatabase } = require('./database');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

if (!process.env.API_KEY && process.env.NODE_ENV !== 'development') {
  throw new Error('API_KEY is missing in environment variables');
}


// ─── CORS Configuration ─────────────────────────────────────────────
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); 
    if (origin.startsWith('http://localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-api-key'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));


// ─── Middleware Configuration ──────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(responseHandler);

// ─── API Key Guard Middleware ──────────────────────────────────────
const apiKeyGuard = (req, res, next) => {
  const key = req.headers['x-api-key'];
  const isInDev = process.env.NODE_ENV === 'development';
  if (key !== process.env.API_KEY && !isInDev) {
    return res.forbidden('Invalid API key');
  }
  next();
};

// ─── Server Initialization Function ────────────────────────────────
const startServer = async () => {
  try {
    await connectToDatabase();
    await setupSwagger(app);

    app.use('/schema', require('./routes/schema'));
    app.use('/service', require('./routes/service'));
    app.use('/api/v1', apiKeyGuard, require('./routes/router'));

    const port = process.env.PORT || 4010;
    const keyPath = './ssl/privat.key';
    const certPath = './ssl/certificate.crt';
    const isDev = process.env.NODE_ENV === 'development';
    const hasSSL = fs.existsSync(keyPath) && fs.existsSync(certPath);

    let server;
    let protocol = 'http';

  if (hasSSL) {
  const sslOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
  server = https.createServer(sslOptions, app);
  protocol = 'https';
  console.log('✅ SSL found: using HTTPS');
} else {
  if (isDev) {
    console.warn('⚠️ SSL not found, but development mode: using HTTP');
    server = http.createServer(app);
    protocol = 'http';
  } else {
    throw new Error('❌ SSL certificates not found. HTTPS is required in production.');
  }
}


    server.listen(port, () => {
      console.log(`${process.env.PROJECT_NAME} Server: running at ${protocol}://localhost:${port}`);
    });

  } catch (err) {
    console.error(`❌ Error starting server: ${err.message}`);
    process.exit(1);
  }
};



startServer();