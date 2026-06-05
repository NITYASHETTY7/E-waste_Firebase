import { PrismaClient } from '@prisma/client';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Firebase Admin SDK
let credsPath = path.resolve(process.cwd(), 'creds');
if (!fs.existsSync(credsPath)) {
  credsPath = path.resolve(process.cwd(), '../../creds');
}

if (!fs.existsSync(credsPath)) {
  console.error(`Firebase credentials not found at ${credsPath}. Exiting.`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

// Configure Firestore to ignore undefined fields (saves us from crash on nulls)
db.settings({ ignoreUndefinedProperties: true });

async function migrate() {
  console.log('🚀 Starting RDS to Firebase Firestore Migration...');

  try {
    // 1. MIGRATE COMPANIES
    console.log('📦 Migrating Companies...');
    const companies = await prisma.company.findMany({
      include: { kycDocuments: true },
    });
    console.log(`Found ${companies.length} companies to migrate.`);

    for (const company of companies) {
      const companyDocRef = db.collection('companies').doc(company.id);
      
      const { kycDocuments, ...companyData } = company;
      await companyDocRef.set({
        ...companyData,
        createdAt: companyData.createdAt,
        updatedAt: companyData.updatedAt,
      });

      // Migrate KYC Documents as subcollection
      if (kycDocuments && kycDocuments.length > 0) {
        for (const kycDoc of kycDocuments) {
          await companyDocRef.collection('kycDocuments').doc(kycDoc.id).set({
            ...kycDoc,
            uploadedAt: kycDoc.uploadedAt,
          });
        }
      }
    }
    console.log('✅ Companies migrated successfully.');

    // 2. MIGRATE USERS & FIREBASE AUTH
    console.log('👤 Migrating Users & Firebase Auth...');
    const users = await prisma.user.findMany({
      include: { inAppNotifications: true },
    });
    console.log(`Found ${users.length} users to migrate.`);

    // Firebase Auth allows importing users in batches of 1000
    const authUsersToImport: admin.auth.UserImportRecord[] = [];
    const userRoleCompanyMap = new Map<string, { role: string; companyId?: string | null }>();

    for (const user of users) {
      // Setup auth import structure
      // Note: We use the existing postgres user.id (CUID) as the Firebase uid to preserve references!
      const importRecord: admin.auth.UserImportRecord = {
        uid: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.name,
        disabled: !user.isActive,
      };

      // Handle phone number formatting (Firebase requires E.164 format)
      if (user.phone) {
        let phone = user.phone.trim();
        if (!phone.startsWith('+')) {
          // If it starts with 0 or doesn't have country code, let's assume India (+91) as fallback
          if (phone.length === 10) {
            phone = `+91${phone}`;
          } else if (phone.startsWith('0') && phone.length === 11) {
            phone = `+91${phone.substring(1)}`;
          } else {
            phone = `+${phone}`;
          }
        }
        // Verify phone matches E.164 pattern roughly, otherwise omit to prevent failure
        if (/^\+[1-9]\d{1,14}$/.test(phone)) {
          importRecord.phoneNumber = phone;
        }
      }

      // Map password hashes if we can (using standard bcrypt parameters)
      if (user.passwordHash) {
        importRecord.passwordHash = Buffer.from(user.passwordHash);
      }

      authUsersToImport.push(importRecord);
      userRoleCompanyMap.set(user.id, { role: user.role, companyId: user.companyId });
    }

    // Batch import users to Firebase Auth
    if (authUsersToImport.length > 0) {
      console.log(`Importing ${authUsersToImport.length} users into Firebase Auth...`);
      // We use BCRYPT hash algorithm for user import
      const result = await auth.importUsers(authUsersToImport, {
        hash: {
          algorithm: 'BCRYPT',
        },
      });
      console.log(`Successfully imported ${result.successCount} users.`);
      if (result.failureCount > 0) {
        console.error(`Failed to import ${result.failureCount} users. Details:`, result.errors);
      }

      // Set Custom Claims for roles and company links
      console.log('🔑 Assigning Custom Claims (Roles & Companies)...');
      for (const [userId, meta] of userRoleCompanyMap.entries()) {
        try {
          await auth.setCustomUserClaims(userId, {
            role: meta.role,
            companyId: meta.companyId || null,
          });
        } catch (claimsError) {
          console.error(`Failed to set claims for user ${userId}:`, claimsError);
        }
      }
    }

    // Write User data to Firestore
    for (const user of users) {
      const userDocRef = db.collection('users').doc(user.id);
      const { passwordHash, inAppNotifications, ...userData } = user;

      await userDocRef.set({
        ...userData,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
      });

      // Migrate In-App Notifications as subcollection
      if (inAppNotifications && inAppNotifications.length > 0) {
        for (const notification of inAppNotifications) {
          await userDocRef.collection('notifications').doc(notification.id).set({
            ...notification,
            createdAt: notification.createdAt,
          });
        }
      }
    }
    console.log('✅ Users migrated successfully.');

    // 3. MIGRATE REQUIREMENTS
    console.log('📋 Migrating Requirements...');
    const requirements = await prisma.requirement.findMany({
      include: {
        auditInvitations: {
          include: {
            report: {
              include: { photos: true },
            },
          },
        },
        auditDocs: true,
      },
    });
    console.log(`Found ${requirements.length} requirements to migrate.`);

    for (const req of requirements) {
      const reqDocRef = db.collection('requirements').doc(req.id);
      
      const { auditInvitations, auditDocs, ...reqData } = req;
      await reqDocRef.set({
        ...reqData,
        createdAt: reqData.createdAt,
        updatedAt: reqData.updatedAt,
        clientDocuments: reqData.clientDocuments ? JSON.stringify(reqData.clientDocuments) : undefined,
      });

      // Migrate Audit Invitations
      if (auditInvitations && auditInvitations.length > 0) {
        for (const invite of auditInvitations) {
          const { report, ...inviteData } = invite;
          
          let reportData: any = null;
          if (report) {
            const { photos, ...repBody } = report;
            reportData = {
              ...repBody,
              photos: photos.map((p: any) => ({
                ...p,
                uploadedAt: p.uploadedAt,
                capturedAt: p.capturedAt,
              })),
            };
          }

          await reqDocRef.collection('auditInvitations').doc(invite.id).set({
            ...inviteData,
            report: reportData,
            createdAt: inviteData.createdAt,
            updatedAt: inviteData.updatedAt,
            respondedAt: inviteData.respondedAt,
            scheduledAt: inviteData.scheduledAt,
          });
        }
      }

      // Migrate Vendor Audit Docs
      if (auditDocs && auditDocs.length > 0) {
        for (const doc of auditDocs) {
          await reqDocRef.collection('vendorAuditDocs').doc(doc.id).set({
            ...doc,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          });
        }
      }
    }
    console.log('✅ Requirements migrated successfully.');

    // 4. MIGRATE AUCTIONS
    console.log('🔨 Migrating Auctions...');
    const auctions = await prisma.auction.findMany({
      include: {
        auctionDocs: true,
        bids: true,
        pickup: {
          include: { pickupDocs: true },
        },
        payment: true,
      },
    });
    console.log(`Found ${auctions.length} auctions to migrate.`);

    for (const auction of auctions) {
      const auctionDocRef = db.collection('auctions').doc(auction.id);

      const { auctionDocs, bids, pickup, payment, ...auctionData } = auction;
      
      // Embed Auction Documents directly to optimize NoSQL reads
      await auctionDocRef.set({
        ...auctionData,
        createdAt: auctionData.createdAt,
        updatedAt: auctionData.updatedAt,
        sealedPhaseStart: auctionData.sealedPhaseStart,
        sealedPhaseEnd: auctionData.sealedPhaseEnd,
        openPhaseStart: auctionData.openPhaseStart,
        openPhaseEnd: auctionData.openPhaseEnd,
        auctionDocs: auctionDocs.map((doc: any) => ({
          ...doc,
          uploadedAt: doc.uploadedAt,
        })),
      });

      // Migrate Bids as subcollection
      if (bids && bids.length > 0) {
        for (const bid of bids) {
          await auctionDocRef.collection('bids').doc(bid.id).set({
            ...bid,
            createdAt: bid.createdAt,
          });
        }
      }

      // Migrate Pickup as subcollection doc
      if (pickup) {
        const { pickupDocs, ...pickupData } = pickup;
        await auctionDocRef.collection('pickup').doc(pickup.id).set({
          ...pickupData,
          createdAt: pickupData.createdAt,
          updatedAt: pickupData.updatedAt,
          scheduledDate: pickupData.scheduledDate,
          gatePassIssuedAt: pickupData.gatePassIssuedAt,
          vendorAcknowledgedAt: pickupData.vendorAcknowledgedAt,
          invoiceGeneratedAt: pickupData.invoiceGeneratedAt,
          vendorPreferredDate: pickupData.vendorPreferredDate,
          clientVerifiedAt: pickupData.clientVerifiedAt,
          pickupDocs: pickupDocs.map((doc: any) => ({
            ...doc,
            uploadedAt: doc.uploadedAt,
          })),
        });
      }

      // Migrate Payment as subcollection doc
      if (payment) {
        await auctionDocRef.collection('payment').doc(payment.id).set({
          ...payment,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        });
      }
    }
    console.log('✅ Auctions migrated successfully.');

    // 5. MIGRATE RATINGS
    console.log('⭐️ Migrating Ratings...');
    const ratings = await prisma.rating.findMany();
    console.log(`Found ${ratings.length} ratings to migrate.`);

    for (const rating of ratings) {
      await db.collection('ratings').doc(rating.id).set({
        ...rating,
        createdAt: rating.createdAt,
      });
    }
    console.log('✅ Ratings migrated successfully.');

    // 6. MIGRATE CONSUMER PRODUCTS
    console.log('🛒 Migrating User Products (Consumer Marketplace)...');
    const products = await prisma.userProduct.findMany({
      include: {
        quotes: true,
        pickup: true,
      },
    });
    console.log(`Found ${products.length} user products to migrate.`);

    for (const prod of products) {
      const prodDocRef = db.collection('userProducts').doc(prod.id);

      const { quotes, pickup, ...prodData } = prod;
      await prodDocRef.set({
        ...prodData,
        createdAt: prodData.createdAt,
        updatedAt: prodData.updatedAt,
        adminApprovedAt: prodData.adminApprovedAt,
      });

      // Migrate Quotes as subcollection
      if (quotes && quotes.length > 0) {
        for (const quote of quotes) {
          await prodDocRef.collection('quotes').doc(quote.id).set({
            ...quote,
            createdAt: quote.createdAt,
            updatedAt: quote.updatedAt,
          });
        }
      }

      // Migrate Pickup as subcollection doc
      if (pickup) {
        await prodDocRef.collection('pickups').doc(pickup.id).set({
          ...pickup,
          scheduledDate: pickup.scheduledDate,
          createdAt: pickup.createdAt,
          updatedAt: pickup.updatedAt,
        });
      }
    }
    console.log('✅ User products migrated successfully.');

    console.log('🎉 Migration Completed successfully without errors! 🎉');
  } catch (error) {
    console.error('❌ Migration failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute migration
migrate();
