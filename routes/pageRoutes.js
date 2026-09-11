const express = require('express');
const pageController = require('../controllers/pageController');
const router = express.Router();

router.get('/', pageController.showMain);

router.get('/calendar', pageController.showCalendar);

module.exports = router;