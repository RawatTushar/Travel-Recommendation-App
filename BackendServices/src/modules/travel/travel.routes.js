const express = require('express');
const travelController = require('./travel.controller');

const router = express.Router();

router.get('/nearby', travelController.getNearbyPlaces);
router.post('/drop-pin', travelController.dropHiddenPin);
router.get('/destinations/:id', travelController.getDestinationDetails);

module.exports = router;

