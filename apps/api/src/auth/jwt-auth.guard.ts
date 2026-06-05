import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private firebaseService: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No authorization token provided');
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      const decodedToken = await this.firebaseService.auth.verifyIdToken(token);
      
      // Map Firebase ID Token to the request.user object
      request.user = {
        userId: decodedToken.uid, // Preserved CUID
        email: decodedToken.email,
        role: decodedToken.role || 'USER', // Custom claim mapped during login/migration
        companyId: decodedToken.companyId || null, // Custom claim mapped during login/migration
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired authorization token');
    }
  }
}
