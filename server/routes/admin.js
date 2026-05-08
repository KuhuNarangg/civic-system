const express = require('express');
const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const { sendStatusUpdateEmail } = require('../services/emailService');

const router = express.Router();

// All admin routes are protected
router.use(auth, isAdmin);

// GET /api/admin/complaints - list with filters
router.get('/complaints', async (req, res) => {
  try {
    const { category, status, severity } = req.query;
    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (status && status !== 'all') filter.status = status;
    if (severity && severity !== 'all') filter.severity = parseInt(severity, 10);

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email');

    res.json({ complaints, count: complaints.length });
  } catch (err) {
    console.error('Admin list error:', err);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// PATCH /api/admin/complaints/:id/status - update status
router.patch('/complaints/:id/status', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid complaint ID' });
    }

    const { status, note } = req.body;
    const allowedStatuses = ['pending', 'in_review', 'in_progress', 'resolved', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const complaint = await Complaint.findById(req.params.id).populate(
      'reportedBy',
      'name email'
    );
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    if (complaint.status === status) {
      return res.status(400).json({ error: 'Complaint already has that status' });
    }

    complaint.status = status;
    complaint.statusHistory.push({
      status,
      changedAt: new Date(),
      note: note || '',
      changedBy: req.userId
    });

    await complaint.save();

    // Fire-and-forget email notification to the reporter
    if (complaint.reportedBy && complaint.reportedBy.email) {
      sendStatusUpdateEmail({
        to: complaint.reportedBy.email,
        name: complaint.reportedBy.name,
        complaintId: complaint._id,
        title: complaint.title,
        status,
        note: note || ''
      }).catch((err) => console.error('Email error:', err.message));
    }

    res.json({ complaint });
  } catch (err) {
    console.error('Admin status update error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// GET /api/admin/stats - dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [byStatus, byCategory, total, resolved] = await Promise.all([
      Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Complaint.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      Complaint.countDocuments(),
      Complaint.find({ status: 'resolved' }).select('createdAt updatedAt')
    ]);

    // Average resolution time in hours
    let avgResolutionHours = 0;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce(
        (sum, c) => sum + (new Date(c.updatedAt) - new Date(c.createdAt)),
        0
      );
      avgResolutionHours = Math.round(totalMs / resolved.length / 1000 / 3600);
    }

    const statusCounts = {
      pending: 0,
      in_review: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0
    };
    byStatus.forEach((s) => {
      if (s._id) statusCounts[s._id] = s.count;
    });

    const categoryCounts = {};
    byCategory.forEach((c) => {
      if (c._id) categoryCounts[c._id] = c.count;
    });

    const totalUsers = await User.countDocuments({ role: 'citizen' });

    res.json({
      total,
      byStatus: statusCounts,
      byCategory: categoryCounts,
      avgResolutionHours,
      totalUsers
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
