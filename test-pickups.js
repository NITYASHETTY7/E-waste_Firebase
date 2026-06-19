const admin = require('firebase-admin');

// Initialize Firebase Admin pointing to emulator
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

admin.initializeApp({ projectId: 'weconnect-abc07' });

const db = admin.firestore();

async function test() {
  try {
    const snap = await db.collectionGroup('pickup').get();
    console.log('Total Pickups in DB:', snap.size);

    const auctionsSnap = await db.collection('auctions').where('status', '==', 'COMPLETED').get();
    console.log('Total Completed Auctions:', auctionsSnap.size);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

test();
