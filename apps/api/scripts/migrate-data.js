/**
 * Firebase Data Migration Script
 * Migrates data from old project to new project
 * 
 * Usage: node scripts/migrate-data.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Configuration - UPDATE THESE PATHS
const OLD_CREDS_PATH = path.resolve(__dirname, '../creds.old'); // Copy old creds here
const NEW_CREDS_PATH = path.resolve(__dirname, '../creds');     // Current new creds

// Collections to migrate
const COLLECTIONS = [
  'users',
  'companies',
  'requirements',
  'auctions',
  'userProducts',
  'ratings',
  'notifications'
];

// Subcollections to migrate
const SUBCOLLECTIONS = [
  { parent: 'companies', sub: 'kycDocuments' },
  { parent: 'companies', sub: 'payment' },
  { parent: 'users', sub: 'notifications' },
  { parent: 'requirements', sub: 'auditInvitations' },
  { parent: 'requirements', sub: 'vendorAuditDocs' },
  { parent: 'auctions', sub: 'bids' },
  { parent: 'auctions', sub: 'pickup' },
  { parent: 'auctions', sub: 'payment' },
  { parent: 'userProducts', sub: 'quotes' },
  { parent: 'userProducts', sub: 'pickups' }
];

// Check credential files exist
if (!fs.existsSync(OLD_CREDS_PATH)) {
  console.error('❌ Old credentials not found at:', OLD_CREDS_PATH);
  console.log('\nPlease copy your OLD project creds file to: apps/api/creds.old');
  process.exit(1);
}

if (!fs.existsSync(NEW_CREDS_PATH)) {
  console.error('❌ New credentials not found at:', NEW_CREDS_PATH);
  process.exit(1);
}

// Initialize old project
const oldServiceAccount = JSON.parse(fs.readFileSync(OLD_CREDS_PATH, 'utf8'));
const oldApp = admin.initializeApp({
  credential: admin.credential.cert(oldServiceAccount),
  databaseURL: `https://${oldServiceAccount.project_id}.firebaseio.com`
}, 'old');

// Initialize new project
const newServiceAccount = JSON.parse(fs.readFileSync(NEW_CREDS_PATH, 'utf8'));
const newApp = admin.initializeApp({
  credential: admin.credential.cert(newServiceAccount),
  databaseURL: `https://${newServiceAccount.project_id}.firebaseio.com`
}, 'new');

const oldDb = oldApp.firestore();
const newDb = newApp.firestore();

// Stats
const stats = {
  collections: {},
  subcollections: {},
  errors: []
};

function convertTimestamps(data) {
  if (!data || typeof data !== 'object') return data;
  
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object') {
      if (value._seconds !== undefined && value._nanoseconds !== undefined) {
        // Firestore timestamp
        result[key] = admin.firestore.Timestamp.fromMillis(
          value._seconds * 1000 + value._nanoseconds / 1000000
        );
      } else if (value instanceof Date) {
        result[key] = admin.firestore.Timestamp.fromDate(value);
      } else {
        result[key] = convertTimestamps(value);
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function migrateCollection(collectionName) {
  console.log(`\n📦 Migrating collection: ${collectionName}`);
  
  try {
    const snapshot = await oldDb.collection(collectionName).get();
    const batch = newDb.batch();
    let count = 0;
    
    for (const doc of snapshot.docs) {
      const data = convertTimestamps(doc.data());
      const newDocRef = newDb.collection(collectionName).doc(doc.id);
      batch.set(newDocRef, data);
      count++;
      
      // Firestore batch limit is 500
      if (count % 450 === 0) {
        await batch.commit();
        console.log(`  ✅ Committed ${count} documents`);
      }
    }
    
    if (count % 450 !== 0) {
      await batch.commit();
    }
    
    stats.collections[collectionName] = count;
    console.log(`  ✅ Migrated ${count} documents`);
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    stats.errors.push({ collection: collectionName, error: error.message });
  }
}

async function migrateSubcollection(parentName, subName) {
  console.log(`\n📂 Migrating subcollection: ${parentName}/{id}/${subName}`);
  
  try {
    const parentsSnapshot = await oldDb.collection(parentName).get();
    let totalCount = 0;
    
    for (const parentDoc of parentsSnapshot.docs) {
      const subSnapshot = await oldDb
        .collection(parentName)
        .doc(parentDoc.id)
        .collection(subName)
        .get();
      
      if (subSnapshot.empty) continue;
      
      const batch = newDb.batch();
      let count = 0;
      
      for (const doc of subSnapshot.docs) {
        const data = convertTimestamps(doc.data());
        const newDocRef = newDb
          .collection(parentName)
          .doc(parentDoc.id)
          .collection(subName)
          .doc(doc.id);
        batch.set(newDocRef, data);
        count++;
      }
      
      await batch.commit();
      totalCount += count;
    }
    
    stats.subcollections[`${parentName}/${subName}`] = totalCount;
    console.log(`  ✅ Migrated ${totalCount} documents`);
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    stats.errors.push({ subcollection: `${parentName}/${subName}`, error: error.message });
  }
}

async function migrateAuthUsers() {
  console.log('\n👥 Migrating Auth users...');
  
  try {
    const oldAuth = oldApp.auth();
    const newAuth = newApp.auth();
    
    const listUsersResult = await oldAuth.listUsers(1000);
    let count = 0;
    
    for (const user of listUsersResult.users) {
      try {
        await newAuth.createUser({
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          displayName: user.displayName,
          photoURL: user.photoURL,
          phoneNumber: user.phoneNumber,
          disabled: user.disabled,
          password: Math.random().toString(36).slice(-8) // Temporary password
        });
        count++;
      } catch (error) {
        // User might already exist
        console.log(`  ⚠️  User ${user.email}: ${error.message}`);
      }
    }
    
    console.log(`  ✅ Migrated ${count} users`);
    stats.authUsers = count;
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    stats.errors.push({ auth: true, error: error.message });
  }
}

async function runMigration() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   FIREBASE DATA MIGRATION TOOL         ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\nOld Project: ${oldServiceAccount.project_id}`);
  console.log(`New Project: ${newServiceAccount.project_id}\n`);
  
  const startTime = Date.now();
  
  // Migrate main collections
  for (const collection of COLLECTIONS) {
    await migrateCollection(collection);
  }
  
  // Migrate subcollections
  for (const { parent, sub } of SUBCOLLECTIONS) {
    await migrateSubcollection(parent, sub);
  }
  
  // Migrate auth users
  await migrateAuthUsers();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Print summary
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   MIGRATION SUMMARY                    ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\nDuration: ${duration}s\n`);
  
  console.log('Collections:');
  Object.entries(stats.collections).forEach(([name, count]) => {
    console.log(`  ${name}: ${count} documents`);
  });
  
  console.log('\nSubcollections:');
  Object.entries(stats.subcollections).forEach(([name, count]) => {
    console.log(`  ${name}: ${count} documents`);
  });
  
  console.log(`\nAuth Users: ${stats.authUsers || 0}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (${stats.errors.length}):`);
    stats.errors.forEach(err => console.log(`  - ${JSON.stringify(err)}`));
  }
  
  console.log('\n✨ Migration complete!\n');
  console.log('⚠️  IMPORTANT:');
  console.log('   - Auth users were created with temporary passwords');
  console.log('   - Use "Forgot Password" to reset passwords');
  console.log('   - Verify all data in Firebase Console before deleting old project\n');
  
  process.exit(0);
}

runMigration().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
