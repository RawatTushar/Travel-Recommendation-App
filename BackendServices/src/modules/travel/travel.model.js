const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    address: { type: String },
    tags: [{ type: String }],
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    price: { type: String },
    crowdLevel: { type: String, enum: ['Low', 'Medium', 'High'] },
    bestTime: { type: String },
    foodAvailability: { type: String },
    popular: { type: Boolean, default: false },
    isUserSubmitted: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  },
);

locationSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Location', locationSchema);

