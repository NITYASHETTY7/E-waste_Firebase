const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const credsPath = path.resolve(__dirname, '../../creds');
const serviceAccount = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkUser() {
  const email = 'everyuse89@gmail.com';
  console.log(`Checking user: ${email}`);
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) {
    console.log('User not found.');
    return;
  }
  const userDoc = snap.docs[0];
  const userData = userDoc.data();
  console.log('User ID:', userDoc.id);
  console.log('Role:', userData.role);
  console.log('Company ID:', userData.companyId);
}

checkUser().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
