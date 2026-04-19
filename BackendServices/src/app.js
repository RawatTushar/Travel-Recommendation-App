const express = require('express');
const cors = require('cors');

const authRoutes = require('./modules/auth/auth.routes');
const travelRoutes = require('./modules/travel/travel.routes');

function createApp() {
  const app = express();

  // Core middleware
  app.use(cors());
  app.use(express.json());

  // Feature routes
  app.use('/api/auth', authRoutes);
  app.use('/api/travel', travelRoutes);

  // Base route
  app.get('/', (req, res) => {
    res.send('Travel App API is running');
  });

  return app;
}

module.exports = createApp;

