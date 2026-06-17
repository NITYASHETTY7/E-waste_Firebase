/**
 * Create Admin User Script
 * Run this to create an admin user in your new Firebase project
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

async function createAdminUser() {
  const email = process.argv[2] || 'admin@ecoloop.com';
  const password = process.argv[3] || 'admin123';
  const name = process.argv[4] || 'Admin User';

  console.log(`🔥 Creating admin user: ${email}\n`);

  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });

    console.log('✅ Firebase Auth user created:', userRecord.uid);

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email,
      name,
      role: 'ADMIN',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Firestore user document created');

    // Create company document for admin
    const companyId = `company-${userRecord.uid}`;
    await db.collection('companies').doc(companyId).set({
      id: companyId,
      name: 'EcoLoop Admin',
      type: 'admin',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Company document created');

    // Update user with companyId
    await db.collection('users').doc(userRecord.uid).update({
      companyId,
    });

    console.log('\n✨ Admin user created successfully!');
    console.log('\n📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('\nYou can now login with these credentials.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser();
