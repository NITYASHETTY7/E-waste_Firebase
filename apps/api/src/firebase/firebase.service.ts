import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firestoreDb: admin.firestore.Firestore;
  private authAdmin: admin.auth.Auth;

  onModuleInit() {
    let credsPath = path.resolve(process.cwd(), 'creds');
    if (!fs.existsSync(credsPath)) {
      credsPath = path.resolve(process.cwd(), '../../creds');
    }

    if (!fs.existsSync(credsPath)) {
      throw new Error(`Firebase credentials not found at ${credsPath}. Please check your setup.`);
    }

    try {
      const serviceAccount = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      
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
}
