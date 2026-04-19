const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !String(uri).trim()) {
    throw new Error('MONGODB_URI is missing. Add it to BackendServices/.env');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = connectDB;
