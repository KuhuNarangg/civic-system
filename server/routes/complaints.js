const express = require('express');
const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { complaintLimiter } = require('../middleware/rateLimiter');
const { upload } = require('../config/cloudinary');
const { classifyComplaint } = require('../services/aiService');
const { reverseGeocode } = require('../services/geocodeService');

const router = express.Router();

// GET /api/complaints/my - protected, current user's complaints
// (must be defined before /:id so 'my' is not interpreted as an ObjectId)
router.get('/my', auth, async (req, res) => {
  try {
    const complaints = await Complaint.find({ reportedBy: req.userId })
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email');
    res.json({ complaints });
  } catch (err) {
    console.error('Get my complaints error:', err);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// POST /api/complaints - submit new complaint
router.post('/', auth, complaintLimiter, upload.single('image'), async (req, res) => {
  try {
    const { title, description, category, latitude, longitude, address: clientAddress } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Coordinates out of range' });
    }

    // Image URL from Cloudinary (multer middleware put this on req.file)
    const imageUrl = req.file && req.file.path ? req.file.path : '';

    // Reverse geocode if no address provided
    let address = clientAddress || '';
    if (!address) {
      address = await reverseGeocode(lat, lng);
    }

    // Run AI classification
    const aiResult = await classifyComplaint(title, description);

    // Use AI category if user picked 'auto' or didn't supply one
    const finalCategory =
      !category || category === 'auto' || category === ''
        ? aiResult.category
        : category;

    // Create complaint
    const complaint = await Complaint.create({
      title: title.trim(),
      description: description.trim(),
      category: finalCategory,
      severity: aiResult.severity,
      severityReason: aiResult.severityReason,
      priorityNote: aiResult.priorityNote,
      imageUrl,
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      address,
      reportedBy: req.userId,
      aiProcessed: true,
      statusHistory: [
        {
          status: 'pending',
          changedAt: new Date(),
          note: 'Complaint submitted',
          changedBy: req.userId
        }
      ]
    });

    // Increment user's complaint count
    await User.findByIdAndUpdate(req.userId, { $inc: { complaintsCount: 1 } });

    // Duplicate detection: find a nearby active complaint with the same category
    try {
      const nearby = await Complaint.findOne({
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: 100 // meters
          }
        },
        category: complaint.category,
        status: { $nin: ['resolved', 'rejected'] },
        _id: { $ne: complaint._id }
      });

      if (nearby) {
        complaint.isDuplicate = true;
        complaint.parentComplaintId = nearby._id;
        await complaint.save();

        nearby.upvotes = (nearby.upvotes || 0) + 1;
        await nearby.save();
      }
    } catch (dupErr) {
      console.error('Duplicate detection error:', dupErr.message);
    }

    const populated = await Complaint.findById(complaint._id).populate(
      'reportedBy',
      'name email'
    );

    res.status(201).json({ complaint: populated });
  } catch (err) {
    console.error('Create complaint error:', err);
    res.status(500).json({ error: err.message || 'Failed to create complaint' });
  }
});

// GET /api/complaints - public list with filters
router.get('/', async (req, res) => {
  try {
    const { category, status, lat, lng, radius } = req.query;
    const filter = {};

    if (category && category !== 'all') filter.category = category;
    if (status && status !== 'all') filter.status = status;

    // Geo-filter (radius in meters)
    if (lat && lng && radius) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      const radiusNum = parseFloat(radius);
      if (!Number.isNaN(latNum) && !Number.isNaN(lngNum) && !Number.isNaN(radiusNum)) {
        filter.location = {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [lngNum, latNum] },
            $maxDistance: radiusNum
          }
        };
      }
    }

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('reportedBy', 'name');

    res.json({ complaints, count: complaints.length });
  } catch (err) {
    console.error('List complaints error:', err);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// GET /api/complaints/:id - single complaint
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid complaint ID' });
    }

    const complaint = await Complaint.findById(req.params.id)
      .populate('reportedBy', 'name email')
      .populate('parentComplaintId', 'title status');

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json({ complaint });
  } catch (err) {
    console.error('Get complaint error:', err);
    res.status(500).json({ error: 'Failed to fetch complaint' });
  }
});

// PATCH /api/complaints/:id/upvote - toggle upvote
router.patch('/:id/upvote', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid complaint ID' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const userId = req.userId.toString();
    const idx = complaint.upvotedBy.findIndex((u) => u.toString() === userId);

    let upvoted;
    if (idx >= 0) {
      complaint.upvotedBy.splice(idx, 1);
      complaint.upvotes = Math.max(0, complaint.upvotes - 1);
      upvoted = false;
    } else {
      complaint.upvotedBy.push(req.userId);
      complaint.upvotes = (complaint.upvotes || 0) + 1;
      upvoted = true;
    }

    await complaint.save();
    res.json({ upvoted, upvotes: complaint.upvotes });
  } catch (err) {
    console.error('Upvote error:', err);
    res.status(500).json({ error: 'Failed to upvote' });
  }
});

module.exports = router;
