const Location = require('./travel.model');

const getNearbyPlaces = async (req, res) => {
  try {
    const { lat, lng, hiddenGemsOnly, maxDistance = 50000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Latitude and Longitude are required.' });
    }

    const coordinates = [parseFloat(lng), parseFloat(lat)];

    let query = {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: parseInt(maxDistance, 10),
        },
      },
    };

    if (hiddenGemsOnly === 'true') {
      query.$or = [
        { isUserSubmitted: true },
        { reviewCount: { $lt: 20 }, rating: { $gte: 4.5 } },
      ];
    }

    const places = await Location.find(query).limit(50);

    res.json({ success: true, data: places });
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const dropHiddenPin = async (req, res) => {
  try {
    const { name, description, image, lat, lng, tags } = req.body;

    if (!name || !lat || !lng) {
      return res.status(400).json({ success: false, message: 'Name, latitude, and longitude are required.' });
    }

    const newLocation = new Location({
      name,
      description,
      image,
      location: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)],
      },
      tags: tags || [],
      isUserSubmitted: true,
      isVerified: false,
    });

    await newLocation.save();

    res.status(201).json({ success: true, data: newLocation, message: 'Hidden gem submitted successfully!' });
  } catch (error) {
    console.error('Error dropping pin:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getDestinationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const place = await Location.findById(id);
    if (!place) return res.status(404).json({ success: false, message: 'Not found' });

    res.json({ success: true, data: place });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getNearbyPlaces,
  dropHiddenPin,
  getDestinationDetails,
};

