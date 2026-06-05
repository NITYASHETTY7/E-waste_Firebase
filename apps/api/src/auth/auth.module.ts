import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    UsersModule,
  ],
  providers: [AuthService, OtpService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
