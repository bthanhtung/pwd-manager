import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { authLimit, Public } from '../common/guards';
import { SESSION_COOKIE, SessionService } from '../common/session.service';
import { AuthService, profileOf } from './auth.service';
import { EmailDto, LoginDto, RegisterDto } from './dto';

@ApiTags('auth')
@Controller('auth')
@Throttle({ default: { limit: authLimit, ttl: 60_000 } })
export class AuthController {
  constructor(private auth: AuthService, private sessions: SessionService) {}

  @Public() @Post('prelogin') @HttpCode(200)
  prelogin(@Body() dto: EmailDto) { return this.auth.prelogin(dto.email); }

  @Public() @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto);
    await this.sessions.create(user.id, req, res);
    return profileOf(user);
  }

  @Public() @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto);
    await this.sessions.create(user.id, req, res);
    return profileOf(user);
  }

  @Public() @Post('logout') @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.destroy(req.cookies?.[SESSION_COOKIE], res);
  }
}
