/**
 * Create Existing Users Script
 * Adds existing users to new Firebase project
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account
const credsPath = path.resolve(__dirname, '../creds');
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

const auth = admin.auth();
const db = admin.firestore();

const users = [
  {
    email: 'nityashetty21@gmail.com',
    password: 'Ewaste77',
    name: 'Admin User',
    role: 'admin',
    companyName: 'EcoLoop Admin',
    companyType: 'admin'
  },
  {
    email: 'eng22am0037@dsu.edu.in',
    password: 'Ewaste37',
    name: 'Client User',
    role: 'client',
    companyName: 'DSU Client',
    companyType: 'client'
  },
  {
    email: 'everyuse89@gmail.com',
    password: 'Password@2026',
    name: 'Vendor User',
    role: 'vendor',
    companyName: 'Vendor Company',
    companyType: 'vendor'
  }
];

async function createUser(userData) {
  const { email, password, name, role, companyName, companyType } = userData;

  console.log(`🔥 Creating ${role} user: ${email}`);

  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });

    console.log(`  ✅ Auth user created: ${userRecord.uid}`);

    // Create company document
    const companyId = `company-${userRecord.uid}`;
    await db.collection('companies').doc(companyId).set({
      id: companyId,
      name: companyName,
      type: companyType,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  ✅ Company created: ${companyId}`);

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email,
      name,
      role,
      status: 'active',
      companyId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  ✅ User document created\n`);

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    console.error(`  ❌ Failed: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

async function createAllUsers() {
  console.log('🔥 Creating existing users in new Firebase project...\n');

  for (const user of users) {
    await createUser(user);
  }

  console.log('✨ All users created!\n');
  console.log('Login credentials:');
  console.log('------------------');
  users.forEach(u => {
    console.log(`${u.role.toUpperCase()}: ${u.email} / ${u.password}`);
  });
  console.log('');

  process.exit(0);
}

createAllUsers().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
