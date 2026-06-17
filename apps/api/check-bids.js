const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const credsPath = path.resolve(__dirname, '../../creds');
const serviceAccount = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkBids() {
  console.log('Checking all bids in the database...');
  try {
    const bidsSnap = await db.collectionGroup('bids').limit(10).get();
    console.log(`Found ${bidsSnap.size} total bids.`);
    bidsSnap.forEach(doc => {
      console.log(`Bid ID: ${doc.id}, Path: ${doc.ref.path}, Data: ${JSON.stringify(doc.data(), null, 2)}`);
    });
  } catch (e) {
    console.error('Bids fetch failed:', e.message);
  }
}

checkBids().then(() => process.exit(0));
