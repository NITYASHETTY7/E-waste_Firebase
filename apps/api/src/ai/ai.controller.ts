import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../firebase/firestore-types';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  @Roles(UserRole.ADMIN)
  async ask(@Body('prompt') prompt: string) {
    console.log('--- AI REQUEST RECEIVED ---', prompt);
    const response = await this.aiService.askAssistant(prompt);
    return { response };
  }
}
