const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'in_review', 'in_progress', 'resolved', 'rejected'],
      required: true
    },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 2000
    },
    category: {
      type: String,
      enum: ['pothole', 'garbage', 'water_leak', 'streetlight', 'other'],
      default: 'other'
    },
    status: {
      type: String,
      enum: ['pending', 'in_review', 'in_progress', 'resolved', 'rejected'],
      default: 'pending',
      index: true
    },
    severity: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    severityReason: { type: String, default: '' },
    priorityNote: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        validate: {
          validator: function (v) {
            return Array.isArray(v) && v.length === 2;
          },
          message: 'Coordinates must be [longitude, latitude]'
        }
      }
    },
    address: { type: String, default: '' },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    upvotes: { type: Number, default: 0 },
    upvotedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    statusHistory: [statusHistorySchema],
    isDuplicate: { type: Boolean, default: false },
    parentComplaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null
    },
    aiProcessed: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

// 2dsphere index for geo queries
complaintSchema.index({ location: '2dsphere' });
complaintSchema.index({ category: 1, status: 1 });
complaintSchema.index({ reportedBy: 1, createdAt: -1 });

module.exports = mongoose.model('Complaint', complaintSchema);
