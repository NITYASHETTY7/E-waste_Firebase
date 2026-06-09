const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let credsPath = path.resolve(__dirname, 'creds');
if (!fs.existsSync(credsPath)) {
  credsPath = path.resolve(__dirname, '../../creds');
}

const serviceAccount = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function check() {
  const snap = await db.collectionGroup('payment').get();
  console.log(`Total payments found: ${snap.size}`);
  snap.forEach(doc => {
    console.log(`Payment ID: ${doc.id}, Parent Auction ID: ${doc.ref.parent.parent.id}, Data:`, doc.data());
  });
  process.exit(0);
}

check().catch(console.error);
