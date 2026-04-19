const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');
const createApp = require('./app');
const port = Number(process.env.PORT) || 4000;

async function start() {
  try {
    await connectDB();
    const app = createApp();
    app.listen(4000, '0.0.0.0', () => {
      console.log(`Server running on http://192.168.1.2:${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
