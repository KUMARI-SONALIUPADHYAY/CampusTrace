
/**
 * CAMPUS TRACE - DATABASE SCHEMA DESIGN (MONGODB/MONGOOSE)
 * 
 * This file contains the architecture for the backend data layer.
 * Relationships:
 * - User -> Items (One-to-Many): A user can post many items.
 * - Item -> Claims (One-to-Many): An item can have multiple competing claim requests.
 * - User -> Claims (One-to-Many): A user can submit multiple claims for different items.
 * - Admin -> Logs (One-to-Many): Track which moderator performed which action.
 */

// Note: In a real Node.js environment, you would use: import mongoose, { Schema, Document } from 'mongoose';
// For design purposes, we define the structure here.

// --- 1. User Schema ---
const UserSchema = {
  name: { type: 'String', required: true, trim: true },
  email: { 
    type: 'String', 
    required: true, 
    unique: true, 
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  },
  role: { 
    type: 'String', 
    enum: ['student', 'admin'], 
    default: 'student' 
  },
  createdAt: { type: 'Date', default: Date.now }
};

// --- 2. Item Schema ---
const ItemSchema = {
  type: { 
    type: 'String', 
    enum: ['lost', 'found'], 
    required: true 
  },
  title: { type: 'String', required: true, trim: true, maxlength: 100 },
  category: { 
    type: 'String', 
    required: true,
    enum: ['Electronics', 'Books & Stationery', 'Clothing & Accessories', 'Keys', 'Cards & IDs', 'Other']
  },
  description: { type: 'String', required: true },
  location: { type: 'String', required: true },
  date: { type: 'Date', required: true },
  imageUrl: { type: 'String' }, // URL to S3/Cloudinary or Base64
  status: { 
    type: 'String', 
    enum: ['Unclaimed', 'ClaimRequested', 'Returned'], 
    default: 'Unclaimed' 
  },
  postedBy: { 
    type: 'Schema.Types.ObjectId', 
    ref: 'User', 
    required: true 
  },
  approved: { type: 'Boolean', default: false }, // For moderator verification
  createdAt: { type: 'Date', default: Date.now }
};

// Indexes for Item Performance
// itemSchema.index({ category: 1, status: 1 });
// itemSchema.index({ title: 'text', description: 'text' }); // For search

// --- 3. Claim Schema ---
const ClaimSchema = {
  itemId: { 
    type: 'Schema.Types.ObjectId', 
    ref: 'Item', 
    required: true 
  },
  claimantUserId: { 
    type: 'Schema.Types.ObjectId', 
    ref: 'User', 
    required: true 
  },
  message: { 
    type: 'String', 
    required: true, 
    minlength: 20 // Ensure they provide actual proof
  },
  status: { 
    type: 'String', 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  createdAt: { type: 'Date', default: Date.now }
};

// --- 4. Admin Activity Log Schema ---
const AdminLogSchema = {
  adminId: { 
    type: 'Schema.Types.ObjectId', 
    ref: 'User', 
    required: true 
  },
  action: { 
    type: 'String', 
    required: true,
    enum: ['APPROVE_ITEM', 'DELETE_ITEM', 'APPROVE_CLAIM', 'REJECT_CLAIM', 'MARK_RETURNED']
  },
  itemId: { 
    type: 'Schema.Types.ObjectId', 
    ref: 'Item' 
  },
  details: { type: 'String' }, // Optional additional context
  timestamp: { type: 'Date', default: Date.now }
};

/**
 * EXAMPLE JSON DOCUMENTS
 */

const exampleUser = {
  "_id": "60d5ec186033120015a97561",
  "name": "Jane Doe",
  "email": "j.doe@university.edu",
  "role": "student",
  "createdAt": "2024-05-20T10:00:00Z"
};

const exampleItem = {
  "_id": "60d5ec186033120015a97562",
  "type": "found",
  "title": "Blue Sony Headphones",
  "category": "Electronics",
  "description": "Found near the cafeteria entrance. Noise cancelling model.",
  "location": "Student Union South",
  "date": "2024-05-19",
  "status": "Unclaimed",
  "postedBy": "60d5ec186033120015a97561",
  "approved": true,
  "createdAt": "2024-05-19T14:30:00Z"
};

const exampleClaim = {
  "_id": "60d5ec186033120015a97563",
  "itemId": "60d5ec186033120015a97562",
  "claimantUserId": "60d5ec186033120015a97569",
  "message": "These are mine! They have a small sticker of a cat on the left ear cup and were left on table 4.",
  "status": "pending",
  "createdAt": "2024-05-20T09:15:00Z"
};
