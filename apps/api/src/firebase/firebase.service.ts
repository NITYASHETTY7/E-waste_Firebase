import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firestoreDb: admin.firestore.Firestore;
  private authAdmin: admin.auth.Auth;
  private serviceAccountKey: any;

  onModuleInit() {
    let serviceAccount: any;

    if (process.env.FIREBASE_CREDS_JSON) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_CREDS_JSON);
        console.log('Firebase credentials loaded from environment variable.');
      } catch (err) {
        throw new Error('Failed to parse FIREBASE_CREDS_JSON environment variable.');
      }
    } else {
      let credsPath = path.resolve(process.cwd(), 'creds');
      if (!fs.existsSync(credsPath)) {
        credsPath = path.resolve(process.cwd(), '../../creds');
      }

      if (!fs.existsSync(credsPath)) {
        throw new Error(`Firebase credentials not found at ${credsPath} and FIREBASE_CREDS_JSON is not set.`);
      }
      
      serviceAccount = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      console.log('Firebase credentials loaded from local file.');
    }

    try {
      this.serviceAccountKey = serviceAccount;
      
      // Initialize Firebase Admin SDK if not already initialized
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }

      this.firestoreDb = admin.firestore();
      this.authAdmin = admin.auth();
      
      // Enable Firestore timestamps in snapshots setting (default in newer SDKs, but good practice)
      this.firestoreDb.settings({ ignoreUndefinedProperties: true });
      
      console.log('Firebase Admin SDK initialized successfully.');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      throw error;
    }
  }

  get db(): admin.firestore.Firestore {
    return this.firestoreDb;
  }

  get auth(): admin.auth.Auth {
    return this.authAdmin;
  }

  get serviceAccount(): any {
    return this.serviceAccountKey;
  }
}
