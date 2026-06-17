/**
 * Initialize Firestore Database
 * Run this to create required collections in a new Firebase project
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account
let credsPath = path.resolve(process.cwd(), 'creds');
if (!fs.existsSync(credsPath)) {
  credsPath = path.resolve(process.cwd(), '../creds');
}
if (!fs.existsSync(credsPath)) {
  credsPath = path.resolve(process.cwd(), '../../creds');
}

if (!fs.existsSync(credsPath)) {
  console.error('❌ Credentials not found at:', credsPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

// Initialize Firebase
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function initializeCollections() {
  console.log('🔥 Initializing Firestore collections...\n');

  const collections = [
    'users',
    'auctions',
    'requirements',
    'companies',
    'notifications',
    'user-products',
    'bids'
  ];

  for (const collectionName of collections) {
    try {
      // Create a dummy document and delete it (just to initialize the collection)
      const dummyRef = db.collection(collectionName).doc('_init');
      await dummyRef.set({
        _initialized: true,
        _createdAt: admin.firestore.FieldValue.serverTimestamp(),
        _note: 'This is a initialization document, you can delete it'
      });
      console.log(`✅ Collection "${collectionName}" initialized`);
    } catch (error) {
      console.error(`❌ Failed to initialize "${collectionName}":`, error.message);
    }
  }

  console.log('\n✨ Firestore initialization complete!');
  console.log('\n⚠️  You can now delete the _init documents in each collection');
  console.log('The collections will persist even after deletion.\n');
  process.exit(0);
}

initializeCollections().catch((error) => {
  console.error('❌ Initialization failed:', error);
  process.exit(1);
});
