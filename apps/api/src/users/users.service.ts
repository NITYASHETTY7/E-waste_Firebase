import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { UserRole, UserDoc, CompanyDoc, CompanyStatus } from '../firebase/firestore-types';

@Injectable()
export class UsersService {
  constructor(private firebaseService: FirebaseService) {}

  private get db() {
    return this.firebaseService.db;
  }

  private get auth() {
    return this.firebaseService.auth;
  }

  async findAll(role?: UserRole) {
    let query: any = this.db.collection('users');
    if (role) {
      query = query.where('role', '==', role);
    }
    
    const snapshot = await query.get();
    const users: UserDoc[] = [];
    
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      users.push({
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
        otpExpiresAt: data.otpExpiresAt?.toDate ? data.otpExpiresAt.toDate() : data.otpExpiresAt,
      });
    });

    // Resolve companies in parallel for better performance
    const populatedUsers = await Promise.all(
      users.map(async (user) => {
        if (user.companyId) {
          const companyDoc = await this.db.collection('companies').doc(user.companyId).get();
          if (companyDoc.exists) {
            return { ...user, company: companyDoc.data() };
          }
        }
        return { ...user, company: null };
      })
    );

    // Sort by createdAt descending
    return populatedUsers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByEmail(email: string) {
    const snapshot = await this.db
      .collection('users')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const user = doc.data() as UserDoc;
    
    let company = null;
    if (user.companyId) {
      const companyDoc = await this.db.collection('companies').doc(user.companyId).get();
      if (companyDoc.exists) {
        company = companyDoc.data() as CompanyDoc;
      }
    }

    return {
      ...user,
      company,
      createdAt: (user.createdAt as any)?.toDate ? (user.createdAt as any).toDate() : user.createdAt,
      updatedAt: (user.updatedAt as any)?.toDate ? (user.updatedAt as any).toDate() : user.updatedAt,
      otpExpiresAt: (user.otpExpiresAt as any)?.toDate ? (user.otpExpiresAt as any).toDate() : user.otpExpiresAt,
    };
  }

  async findById(id: string) {
    const doc = await this.db.collection('users').doc(id).get();
    if (!doc.exists) throw new NotFoundException('User not found');

    const user = doc.data() as UserDoc;

    let company = null;
    if (user.companyId) {
      const companyDoc = await this.db.collection('companies').doc(user.companyId).get();
      if (companyDoc.exists) {
        company = companyDoc.data() as CompanyDoc;
      }
    }

    return {
      ...user,
      company,
      createdAt: (user.createdAt as any)?.toDate ? (user.createdAt as any).toDate() : user.createdAt,
      updatedAt: (user.updatedAt as any)?.toDate ? (user.updatedAt as any).toDate() : user.updatedAt,
      otpExpiresAt: (user.otpExpiresAt as any)?.toDate ? (user.otpExpiresAt as any).toDate() : user.otpExpiresAt,
    };
  }

  async create(data: {
    email: string;
    name: string;
    password?: string; // Raw password for Firebase Auth
    role?: string;
    phone?: string;
  }) {
    const emailNorm = data.email.toLowerCase().trim();
    const existing = await this.findByEmail(emailNorm);
    if (existing) throw new ConflictException('Email already registered');

    // Format phone to E.164 for Firebase Auth
    let formattedPhone = data.phone?.trim();
    if (formattedPhone) {
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.length === 10) {
          formattedPhone = `+91${formattedPhone}`;
        } else {
          formattedPhone = `+${formattedPhone}`;
        }
      }
      if (!/^\+[1-9]\d{1,14}$/.test(formattedPhone)) {
        formattedPhone = undefined; // Drop if invalid to prevent Firebase Auth crash
      }
    }

    // 1. Create in Firebase Auth
    const authUser = await this.auth.createUser({
      email: emailNorm,
      password: data.password || Math.random().toString(36).slice(-10), // Fallback random pass
      displayName: data.name,
      phoneNumber: formattedPhone || undefined,
    });

    const role = (data.role as UserRole) || UserRole.USER;

    // 2. Set Firebase Custom Claims for Role & Company links (saves DB lookups during guard check!)
    await this.auth.setCustomUserClaims(authUser.uid, {
      role,
      companyId: null,
    });

    // 3. Save User Profile doc in Firestore (matching uid)
    const userProfile: UserDoc = {
      id: authUser.uid,
      email: emailNorm,
      name: data.name,
      role,
      phone: data.phone || null,
      emailVerified: false,
      phoneVerified: false,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.collection('users').doc(authUser.uid).set(userProfile);

    return userProfile;
  }

  async linkToCompany(userId: string, companyId: string) {
    // 1. Update Custom Claims in Firebase Auth to include companyId
    const userDoc = await this.findById(userId);
    await this.auth.setCustomUserClaims(userId, {
      role: userDoc.role,
      companyId,
    });

    // 2. Update Firestore Doc
    await this.db.collection('users').doc(userId).update({
      companyId,
      updatedAt: new Date(),
    });

    return { success: true };
  }

  async updateRole(id: string, role: UserRole) {
    const userDoc = await this.findById(id);
    
    // 1. Update Custom Claims
    await this.auth.setCustomUserClaims(id, {
      role,
      companyId: userDoc.companyId,
    });

    // 2. Update Firestore
    await this.db.collection('users').doc(id).update({
      role,
      updatedAt: new Date(),
    });

    return { success: true };
  }

  async approveUser(id: string) {
    const userDoc = await this.findById(id);

    // Update Auth enabled status (Firebase Auth)
    await this.auth.updateUser(id, { disabled: false });

    // Update User active status
    await this.db.collection('users').doc(id).update({
      isActive: true,
      updatedAt: new Date(),
    });

    // Update Company status if exists
    if (userDoc.companyId) {
      await this.db.collection('companies').doc(userDoc.companyId).update({
        status: CompanyStatus.APPROVED,
        updatedAt: new Date(),
      });
    }

    return this.findById(id);
  }

  async rejectUser(id: string) {
    const userDoc = await this.findById(id);

    // Disable in Firebase Auth
    await this.auth.updateUser(id, { disabled: true });

    // Deactivate in Firestore
    await this.db.collection('users').doc(id).update({
      isActive: false,
      updatedAt: new Date(),
    });

    if (userDoc.companyId) {
      await this.db.collection('companies').doc(userDoc.companyId).update({
        status: CompanyStatus.REJECTED,
        updatedAt: new Date(),
      });
    }

    return this.findById(id);
  }

  async holdUser(id: string) {
    const userDoc = await this.findById(id);

    // Disable in Firebase Auth
    await this.auth.updateUser(id, { disabled: true });

    // Deactivate in Firestore
    await this.db.collection('users').doc(id).update({
      isActive: false,
      updatedAt: new Date(),
    });

    if (userDoc.companyId) {
      await this.db.collection('companies').doc(userDoc.companyId).update({
        status: CompanyStatus.BLOCKED,
        updatedAt: new Date(),
      });
    }

    return this.findById(id);
  }

  async createAdmin(data: { email: string; name: string; password: string }) {
    const emailNorm = data.email.toLowerCase().trim();
    const existing = await this.findByEmail(emailNorm);
    if (existing) throw new ConflictException('Email already registered');

    // 1. Create Firebase Auth user
    const authUser = await this.auth.createUser({
      email: emailNorm,
      password: data.password,
      displayName: data.name,
      emailVerified: true,
    });

    // 2. Set Claims
    await this.auth.setCustomUserClaims(authUser.uid, {
      role: UserRole.ADMIN,
      companyId: null,
    });

    // 3. Create Firestore User Doc
    const adminProfile: UserDoc = {
      id: authUser.uid,
      email: emailNorm,
      name: data.name,
      role: UserRole.ADMIN,
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.collection('users').doc(authUser.uid).set(adminProfile);

    return adminProfile;
  }

  async deleteMe(userId: string) {
    // 1. Delete from Firebase Auth
    await this.auth.deleteUser(userId);

    // 2. Delete Firestore User Doc
    await this.db.collection('users').doc(userId).delete();

    return { success: true };
  }
}
