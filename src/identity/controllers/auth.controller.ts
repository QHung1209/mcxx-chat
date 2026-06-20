
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from 'src/support/utils/jwt.guard';
import { UserService } from '../services/user.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from '../dto/auth.dto';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  private readonly callbackUrl: string;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    const url = this.configService.get('APP_URL');
    this.callbackUrl = `${url}/auth/google/callback`;
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    const result = await this.authService.register(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      scope: 'user',
    });
    return {
      statusCode: 201,
      result,
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const result = await this.authService.login(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      scope: 'user',
    });
    return {
      statusCode: 200,
      result,
    };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return {
      statusCode: 200,
    };
  }

  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(dto);
    return {
      statusCode: 200,
      result,
    };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return {
      statusCode: 200,
    };
  }

  @Get('google')
  async googleLoginUrl(
    @Query('redirectUrl') redirectUrl: string | undefined,
    @Res() res: Response,
  ) {
    const login = await this.authService.googleLoginUrl(redirectUrl);
    return res.redirect(login);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string | undefined,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { redirectUrl } = this.authService.decodeState(state);
    const result = await this.authService.handleGoogleCallback(
      code,
      this.callbackUrl,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        scope: 'user',
      },
    );
    return res.redirect(
      this.authService.buildRedirectUrl(redirectUrl, result.tokens),
    );
  }

  @Post('refresh-token')
  async refreshToken(@Body() dto: RefreshTokenDto, @Req() req: any) {
    const tokens = await this.authService.refreshToken(dto.refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return {
      statusCode: 200,
      result: tokens,
    };
  }

  @Post('change-password')
  @UseGuards(new JwtAuthGuard('user'))
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    await this.authService.changePassword(req.user.id, dto);
    return {
      statusCode: 200,
    };
  }

  @Post('logout')
  @UseGuards(new JwtAuthGuard('user'))
  async logout(@Req() req: any) {
    await this.authService.logout(req.user);
    return {
      statusCode: 200,
    };
  }

  @Get('me')
  @UseGuards(new JwtAuthGuard('user'))
  async getMe(@Req() req: any) {
    const user = await this.userService.getUserById(req.user.id);
    return {
      statusCode: 200,
      result: { ...user, scope: 'user' },
    };
  }
}
