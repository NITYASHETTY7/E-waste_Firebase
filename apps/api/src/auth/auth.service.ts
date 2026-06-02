import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CompanyType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { OtpService } from './otp.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private otpService: OtpService,
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  async completeVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) throw new NotFoundException('User not found');

    // User might not have a phone number depending on role, check appropriately
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
      if (existing.isActive)
        throw new ConflictException('Email already registered');

      // Incomplete registration — verify the password matches before resuming
      const passwordMatch = await bcrypt.compare(
        dto.password,
        existing.passwordHash,
      );
      if (!passwordMatch)
        throw new ConflictException('Email already registered');

      const freshUser = await this.prisma.user.findUnique({
        where: { id: existing.id },
        include: { company: { include: { kycDocuments: true } } },
      });

      return {
        ...this.buildResponse(freshUser ?? existing),
        resumed: true,
        resumeStep: this.computeResumeStep(freshUser ?? existing),
      };
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash: hash,
      role: dto.role || 'USER',
      phone: dto.phone,
    });

    // For CLIENT and VENDOR roles, create a Company record with PENDING status
    const role = ((dto.role as string) || 'USER').toUpperCase();
    if (role === 'CLIENT' || role === 'VENDOR') {
      const company = await this.prisma.company.create({
        data: {
          name: dto.name,
          type: role as CompanyType,
          status: 'PENDING',
        },
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { companyId: company.id },
      });
    }

    // Re-fetch user so companyId is included in the response
    const freshUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { company: true },
    });

    const finalUser = freshUser || user;

    return this.buildResponse(finalUser);
  }

  async sendPostOtpNotifications(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

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
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
    });

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

    // Step 1 complete only if all mandatory company fields are present
    const hasBasicDetails =
      company.gstNumber &&
      company.panNumber &&
      company.address &&
      company.city &&
      company.state &&
      company.pincode;

    if (!hasBasicDetails) return 1;

    // Step 2 complete if documents are uploaded
    if (!company.kycDocuments || company.kycDocuments.length === 0) return 2;

    // Step 3 complete if bank details are filled
    if (!company.bankAccountNumber) return 3;

    // Otherwise, resume from Step 4 (OTP)
    return 4;
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !dto.password) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isActive === false || user.company?.status === 'PENDING') {
      throw new UnauthorizedException(
        'Your account is pending admin approval. Check your email for updates.',
      );
    }
    return this.buildResponse(user);
  }

  async getProfile(userId: string) {
    return this.usersService.findById(userId);
  }

  async markVerified(email: string, type: 'email' | 'phone') {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    const updateData =
      type === 'email' ? { emailVerified: true } : { phoneVerified: true };
    await this.prisma.user.update({ where: { id: user.id }, data: updateData });

    // Activate account once both email and phone are verified
    const fresh = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (fresh?.emailVerified && fresh?.phoneVerified) {
      // CLIENT/VENDOR are activated via company approval; USER role needs admin approval
      if (fresh.role !== 'USER') {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { isActive: true },
        });
      }
    }
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

    const hash = await (await import('bcryptjs')).hash(newPassword, 10);
    await this.prisma.user.update({
      where: { email },
      data: { passwordHash: hash },
    });
    return { success: true };
  }

  private buildResponse(user: any) {
    const { passwordHash, ...safeUser } = user;
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: safeUser,
    };
  }
}
