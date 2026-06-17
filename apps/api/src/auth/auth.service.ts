import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CompanyStatus, CompanyType } from '../firebase/firestore-types';
import { NotificationService } from '../notifications/notification.service';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { OtpService } from './otp.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private firebaseService: FirebaseService,
    private otpService: OtpService,
    private notifications: NotificationService,
  ) {}

  private get db() {
    return this.firebaseService.db;
  }

  private get auth() {
    return this.firebaseService.auth;
  }

  async completeVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    if (!user.emailVerified || (user.phone && !user.phoneVerified)) {
      throw new BadRequestException(
        'Both email and phone must be verified before completing registration',
      );
    }

    // Only now send the notifications
    await this.sendPostOtpNotifications(email);

    return { success: true, message: 'Registration complete' };
  }

  async register(dto: RegisterDto) {
    // Check for an incomplete registration to resume
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      if ((existing as any).status === 'REJECTED') {
         throw new ConflictException('Your previous account application was rejected. You cannot register again with this email.');
      }
      if (existing.isActive || (existing as any).status === 'APPROVED')
        throw new ConflictException('Email already registered');

      // Resuming incomplete registration
      return {
        ...await this.buildResponse(existing),
        resumed: true,
        resumeStep: this.computeResumeStep(existing),
      };
    }

    // Create user in Firebase Auth + Firestore
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      password: dto.password,
      role: dto.role || 'USER',
      phone: dto.phone,
    });

    // For CLIENT and VENDOR roles, create a Company record with PENDING status
    const role = (dto.role || 'USER').toUpperCase();
    if (role === 'CLIENT' || role === 'VENDOR') {
      const companyId = this.db.collection('companies').doc().id;
      const companyData = {
        id: companyId,
        name: dto.name,
        type: role as CompanyType,
        status: CompanyStatus.PENDING,
        rating: 0,
        ratingCount: 0,
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.db.collection('companies').doc(companyId).set(companyData);
      
      // Update User profile with company ID and update Auth Claims
      await this.usersService.linkToCompany(user.id, companyId);
    }

    // Re-fetch user so company data is included in the response
    const freshUser = await this.usersService.findById(user.id);

    return this.buildResponse(freshUser);
  }

  async sendPostOtpNotifications(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    // Send "under review" email to the registered user
    this.notifications
      .sendEmail({
        to: user.email,
        subject: 'Your account is under review - WeConnect',
        body: `Thank you for completing your registration on WeConnect.
      Your account is currently being reviewed by our admin team.
      You will receive an email within 24-72 hours once approved.`,
      })
      .catch(() => {});

    // Send in-app notification to all admins
    await this.notifications
      .notifyAdmins({
        type: 'new_registration_pending',
        title: 'New User Registration',
        message: `A new ${user.role.toLowerCase()} "${user.name}" (${user.email}) has registered and requires approval.`,
        link: '/admin/users',
      })
      .catch(() => {});

    // Fetch ALL admins from database
    const snapshot = await this.db
      .collection('users')
      .where('role', '==', 'ADMIN')
      .where('isActive', '==', true)
      .get();

    const admins: any[] = [];
    snapshot.forEach((doc: any) => admins.push(doc.data()));

    // Send notification email to EVERY admin
    for (const admin of admins) {
      this.notifications
        .sendEmail({
          to: admin.email,
          subject: `New ${user.role} pending approval - ${user.name}`,
          body: `
          <p>A new user has completed registration and requires your approval.</p>
          <p><strong>Name:</strong> ${user.name}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Role:</strong> ${user.role}</p>
          <p><strong>Company:</strong> ${user.company?.name || 'N/A'}</p>
          <p><strong>Registered:</strong> ${new Date().toLocaleString('en-IN')}</p>
          <p>Please login to the admin dashboard to approve or reject.</p>
          <a href="${process.env.WEB_URL || 'http://localhost:3000'}/admin/users">
            Review Application
          </a>
        `,
        })
        .catch(() => {});
    }
  }

  private computeResumeStep(user: any): number {
    const company = user?.company;
    if (!company) return 1;

    const hasBasicDetails =
      company.gstNumber &&
      company.panNumber &&
      company.address &&
      company.city &&
      company.state &&
      company.pincode;

    if (!hasBasicDetails) return 1;

    return 2;
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password using Firebase Auth REST API
    try {
      const serviceAccount = this.firebaseService.serviceAccount;
      const apiKey = process.env.FIREBASE_API_KEY; // Web API Key needed
      
      if (apiKey) {
        // Call Firebase Auth REST API to verify password
        const response = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: dto.email,
              password: dto.password,
              returnSecureToken: true
            })
          }
        );
        
        if (!response.ok) {
          throw new UnauthorizedException('Invalid credentials');
        }
      }
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // If API call fails, log but continue (fallback for development)
      console.error('Password verification error:', error.message);
    }

    if ((user as any).status === 'REJECTED' || user.company?.status === CompanyStatus.REJECTED) {
      throw new UnauthorizedException('Your account application has been rejected. You cannot sign in or register again with this email.');
    }

    if (user.role === 'ADMIN' && user.isActive) {
      return this.buildResponse(user);
    }

    if (user.isActive === false || user.company?.status === CompanyStatus.PENDING) {
      const isBlocked = (user as any).status === 'BLOCKED' || user.company?.status === CompanyStatus.BLOCKED;
      const msg = isBlocked 
        ? 'Your account has been placed on hold. Check your email for updates.' 
        : 'Your account is pending admin approval. Check your email for updates.';
      throw new UnauthorizedException(msg);
    }

    return this.buildResponse(user);
  }

  async getProfile(userId: string) {
    return this.usersService.findById(userId);
  }

  async markVerified(email: string, type: 'email' | 'phone') {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    const updateData: any =
      type === 'email' ? { emailVerified: true } : { phoneVerified: true };
    updateData.updatedAt = new Date();

    await this.db.collection('users').doc(user.id).update(updateData);

    // Account activation is now manual
  }

  async forgotPassword(
    email: string,
  ): Promise<{ sent: boolean; devOtp?: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user)
      throw new NotFoundException('No account found with that email address.');

    const result = await this.otpService.sendOtp(email);
    return { sent: result.emailSent || true, devOtp: result.devEmailOtp };
  }

  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const verify = await this.otpService.verifyOtp(email, otp, 'email');
    if (!verify.verified) throw new BadRequestException(verify.message);

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    // Update password in Firebase Auth!
    await this.auth.updateUser(user.id, {
      password: newPassword,
    });

    return { success: true };
  }

  private async buildResponse(user: any) {
    // Generate secure Firebase Custom Token for backend-initiated logins
    const customToken = await this.auth.createCustomToken(user.id);
    
    return {
      access_token: customToken,
      user,
    };
  }
}
