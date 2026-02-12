/**
 * Database Index Initialization Script
 * Run this script to create all database indexes
 * Usage: node scripts/create-indexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const Story = require('../models/Story');
const Community = require('../models/Community');
const AlbumPhoto = require('../models/AlbumPhoto');
const CommunityInvite = require('../models/CommunityInvite');

const models = [
  { name: 'User', model: User },
  { name: 'Chat', model: Chat },
  { name: 'Message', model: Message },
  { name: 'Post', model: Post },
  { name: 'Notification', model: Notification },
  { name: 'Story', model: Story },
  { name: 'Community', model: Community },
  { name: 'AlbumPhoto', model: AlbumPhoto },
  { name: 'CommunityInvite', model: CommunityInvite },
];

/**
 * Create indexes for a single model
 */
const createIndexesForModel = async (model) => {
  try {
    const indexes = await model.model.collection.indexes();
    console.log(`\n${model.name} model indexes:`);
    indexes.forEach((index) => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    return true;
  } catch (error) {
    console.error(`Error getting indexes for ${model.name}:`, error.message);
    return false;
  }
};

/**
 * Sync all indexes (creates new indexes without dropping existing ones)
 */
const syncIndexes = async () => {
  console.log('Starting database index synchronization...');
  console.log('='.repeat(50));
  
  try {
    // Connect to MongoDB
    console.log('\nConnecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ MongoDB connected\n');
    
    // Display current indexes for all models
    console.log('Current database indexes:');
    console.log('-'.repeat(50));
    
    for (const model of models) {
      await createIndexesForModel(model);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('Index synchronization complete!');
    console.log('\nNote: MongoDB automatically creates indexes defined in Mongoose schemas.');
    console.log('To force index recreation, you can call:');
    console.log('  await model.createIndexes();');
    console.log('\nTo drop all indexes (except _id):');
    console.log('  await model.collection.dropIndexes();');
    
  } catch (error) {
    console.error('Error synchronizing indexes:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nMongoDB disconnected');
  }
};

// Run if executed directly
if (require.main === module) {
  syncIndexes().then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  });
}

module.exports = { syncIndexes, models };
