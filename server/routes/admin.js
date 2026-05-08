const express = require('express');
const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const { sendStatusUpdateEmail } = require('../services/emailService');

const router = express.Router();
router.use(auth, isAdmin);

const VALID_STATUSES = ['pending', 'in_review', 'in_progress', 'resolved', 'rejected'];
const VALID_CATEGORIES = ['pothole', 'garbage', 'water_leak', 'streetlight', 'other'];

// Escape regex metacharacters so user search input can't crash Mongo
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isValidDate = (v) => {
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
};

/**
 * Build a Mongo filter from query params.
 * Supports: status, category, dateFrom, dateTo, search
 */
const buildFilter = (q) => {
  const filter = {};
  if (q.status && q.status !== 'all' && VALID_STATUSES.includes(q.status)) {
    filter.status = q.status;
  }
  if (q.category && q.category !== 'all' && VALID_CATEGORIES.includes(q.category)) {
    filter.category = q.category;
  }

  if ((q.dateFrom && isValidDate(q.dateFrom)) || (q.dateTo && isValidDate(q.dateTo))) {
    filter.createdAt = {};
    if (q.dateFrom && isValidDate(q.dateFrom)) {
      filter.createdAt.$gte = new Date(q.dateFrom);
    }
    if (q.dateTo && isValidDate(q.dateTo)) {
      const end = new Date(q.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (q.search && typeof q.search === 'string' && q.search.trim()) {
    const term = escapeRegex(q.search.trim());
    filter.$or = [{ title: { $regex: term, $options: 'i' } }];
  }

  return filter;
};

const buildSort = (sortKey) => {
  switch (sortKey) {
    case 'oldest':
      return { createdAt: 1 };
    case 'severity':
      return { severity: -1, createdAt: -1 };
    case 'upvotes':
      return { upvotes: -1, createdAt: -1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
};

// GET /api/admin/complaints - paginated list with filters
router.get('/complaints', async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const sort = buildSort(req.query.sort);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('reportedBy', 'name email')
        .populate('parentComplaintId', 'title status'),
      Complaint.countDocuments(filter)
    ]);

    res.json({
      complaints,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      limit
    });
  } catch (err) {
    console.error('Admin list error:', err);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// PATCH /api/admin/complaints/:id/status - update status + notify citizen
router.patch('/complaints/:id/status', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid complaint ID' });
    }

    const { status, note } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    if (status === 'rejected' && (!note || !note.trim())) {
      return res.status(400).json({ error: 'Rejection reason required' });
    }
    if (note && note.length > 500) {
      return res.status(400).json({ error: 'Note cannot exceed 500 characters' });
    }

    const complaint = await Complaint.findById(req.params.id).populate(
      'reportedBy',
      'name email'
    );
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    if (complaint.status === status && !note) {
      return res.status(400).json({ error: 'Complaint already has that status' });
    }

    complaint.status = status;
    complaint.statusHistory.push({
      status,
      changedAt: new Date(),
      note: (note || '').trim(),
      changedBy: req.userId
    });

    await complaint.save();

    // Fire-and-forget email
    if (complaint.reportedBy && complaint.reportedBy.email) {
      sendStatusUpdateEmail({
        to: complaint.reportedBy.email,
        name: complaint.reportedBy.name,
        complaintId: complaint._id,
        title: complaint.title,
        status,
        note: (note || '').trim()
      }).catch((err) => console.error('Email error:', err.message));
    }

    res.json({ complaint });
  } catch (err) {
    console.error('Admin status update error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// PATCH /api/admin/complaints/:id/duplicate - manually mark/unmark duplicate
router.patch('/complaints/:id/duplicate', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid complaint ID' });
    }
    const { parentComplaintId } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    if (parentComplaintId === null || parentComplaintId === '') {
      // Unmark
      complaint.isDuplicate = false;
      complaint.parentComplaintId = null;
      await complaint.save();
      return res.json({ complaint });
    }

    if (!mongoose.Types.ObjectId.isValid(parentComplaintId)) {
      return res.status(400).json({ error: 'Invalid parent complaint ID' });
    }
    if (parentComplaintId === req.params.id) {
      return res.status(400).json({ error: 'Cannot mark complaint as duplicate of itself' });
    }
    const parent = await Complaint.findById(parentComplaintId);
    if (!parent) return res.status(404).json({ error: 'Parent complaint not found' });

    complaint.isDuplicate = true;
    complaint.parentComplaintId = parent._id;
    parent.upvotes = (parent.upvotes || 0) + 1;

    await Promise.all([complaint.save(), parent.save()]);

    res.json({ complaint });
  } catch (err) {
    console.error('Mark duplicate error:', err);
    res.status(500).json({ error: 'Failed to mark duplicate' });
  }
});

// GET /api/admin/stats - dashboard metrics
router.get('/stats', async (req, res) => {
  try {
    // Run each query in its own try/catch so one failure can't 500 the whole endpoint
    const safe = async (fn, fallback) => {
      try {
        return await fn();
      } catch (err) {
        console.error('Stats sub-query failed:', err.message);
        return fallback;
      }
    };

    const [byStatus, byCategory, total, resolvedComplaints, totalUsers] = await Promise.all([
      safe(() => Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]), []),
      safe(() => Complaint.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]), []),
      safe(() => Complaint.countDocuments(), 0),
      safe(
        () => Complaint.find({ status: 'resolved' }).select('createdAt statusHistory updatedAt'),
        []
      ),
      safe(() => User.countDocuments({ role: 'citizen' }), 0)
    ]);

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

    const categoryCounts = {
      pothole: 0,
      garbage: 0,
      water_leak: 0,
      streetlight: 0,
      other: 0
    };
    byCategory.forEach((c) => {
      if (c._id) categoryCounts[c._id] = c.count;
    });

    // Resolved this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const resolvedThisWeek = resolvedComplaints.filter((c) => {
      const resolvedEntry = (c.statusHistory || [])
        .filter((h) => h.status === 'resolved')
        .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))[0];
      const when = resolvedEntry ? new Date(resolvedEntry.changedAt) : new Date(c.updatedAt);
      return when >= oneWeekAgo;
    }).length;

    // Avg resolution days (using resolved entry timestamp - createdAt)
    let totalDays = 0;
    let counted = 0;
    resolvedComplaints.forEach((c) => {
      const resolvedEntry = (c.statusHistory || [])
        .filter((h) => h.status === 'resolved')
        .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))[0];
      if (resolvedEntry) {
        const days =
          (new Date(resolvedEntry.changedAt) - new Date(c.createdAt)) /
          (1000 * 60 * 60 * 24);
        if (!Number.isNaN(days) && days >= 0) {
          totalDays += days;
          counted++;
        }
      }
    });
    const avgResolutionDays = counted > 0 ? Math.round((totalDays / counted) * 10) / 10 : 0;

    // Per-day complaint count for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const perDay = await safe(
      () =>
        Complaint.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),
      []
    );

    res.json({
      total,
      ...statusCounts,
      resolvedThisWeek,
      avgResolutionDays,
      byCategory: categoryCounts,
      perDay: perDay.map((d) => ({ date: d._id, count: d.count })),
      totalUsers
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// CSV escape helper
const csvEscape = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

// GET /api/admin/export - download all complaints (filtered) as CSV
router.get('/export', async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email')
      .lean();

    const headers = [
      'ID',
      'Title',
      'Category',
      'Severity',
      'Status',
      'Reporter Name',
      'Reporter Email',
      'Address',
      'Latitude',
      'Longitude',
      'Submitted Date',
      'Resolved Date',
      'Total Days',
      'Upvotes',
      'Is Duplicate'
    ];
    const rows = [headers.join(',')];

    complaints.forEach((c) => {
      const coords = c.location && c.location.coordinates ? c.location.coordinates : [null, null];
      const [lng, lat] = coords;
      const resolvedEntry = (c.statusHistory || [])
        .filter((h) => h.status === 'resolved')
        .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))[0];
      const resolvedDate = resolvedEntry ? new Date(resolvedEntry.changedAt) : null;
      const totalDays = resolvedDate
        ? Math.round(((resolvedDate - new Date(c.createdAt)) / 86400000) * 10) / 10
        : '';

      const row = [
        String(c._id).slice(-6).toUpperCase(),
        c.title,
        c.category,
        c.severity,
        c.status,
        c.reportedBy ? c.reportedBy.name : '',
        c.reportedBy ? c.reportedBy.email : '',
        c.address || '',
        lat != null ? lat : '',
        lng != null ? lng : '',
        new Date(c.createdAt).toISOString(),
        resolvedDate ? resolvedDate.toISOString() : '',
        totalDays,
        c.upvotes || 0,
        c.isDuplicate ? 'Yes' : 'No'
      ];
      rows.push(row.map(csvEscape).join(','));
    });

    const filename = `complaints-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(rows.join('\n'));
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export complaints' });
  }
});

module.exports = router;
