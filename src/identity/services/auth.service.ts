import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from '../dto/auth.dto';
import { BaseAuthService } from 'src/support/services/base-auth.service';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { MediaService } from 'src/media/services/media.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly baseAuthService: BaseAuthService,
    private readonly configService: ConfigService,
    private readonly mediaService: MediaService,
  ) {}

  async googleLoginUrl(redirectUrl?: string) {
    const clientID = this.configService.get('GOOGLE_AUTH_CLIENT_ID');
    const redirectURI = this.configService.get('GOOGLE_AUTH_REDIRECT_URI');
    const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = new URLSearchParams({
      client_id: clientID,
      redirect_uri: redirectURI,
      response_type: 'code',
      scope: 'openid email profile',
    });
    const state = this.encodeState({ redirectUrl });
    if (state) {
      params.set('state', state);
    }
    return `${googleAuthUrl}?${params.toString()}`;
  }

  encodeState(data: { redirectUrl?: string }) {
    const payload: Record<string, string> = {};
    if (data.redirectUrl) payload.redirectUrl = data.redirectUrl;
    if (!Object.keys(payload).length) return undefined;
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  decodeState(state?: string): { redirectUrl?: string } {
    if (!state) return {};
    try {
      const parsed = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      );
      return { redirectUrl: parsed.redirectUrl };
    } catch {
      return {};
    }
  }

  buildRedirectUrl(
    redirectUrl: string | undefined,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    const feUrl = this.configService.get('FE_URL') ?? 'http://localhost:3000';
    const url = new URL(redirectUrl || '/auth/callback', feUrl);
    url.searchParams.set('accessToken', tokens.accessToken);
    url.searchParams.set('refreshToken', tokens.refreshToken);
    return url.toString();
  }

  async handleGoogleCallback(code: string, url: string, payload: any) {
    const { user, picture, trackingId } =
      await this.baseAuthService.googleLogin(
        code,
        url,
        payload,
        this.userRepository,
      );

    if (picture) {
      await this.ensureGoogleAvatar(user, picture);
    }

    return this.finalizeSession(user, payload, trackingId);
  }

  private async ensureGoogleAvatar(user: User, pictureUrl: string) {
    if (user.avatarMediaId) return;

    const resp = await fetch(pictureUrl);
    if (!resp.ok) return;
    const contentType = resp.headers.get('content-type') ?? 'image/jpeg';
    const buffer = Buffer.from(await resp.arrayBuffer());
    const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';

    const media = await this.mediaService.upload(
      {
        buffer,
        mimetype: contentType,
        size: buffer.length,
        originalname: `google-avatar.${ext}`,
      },
      { uploaderId: user.id, acl: true },
    );

    await this.userRepository.update(user.id, { avatarMediaId: media.id });
    user.avatarMediaId = media.id;
  }

  async register(dto: RegisterDto, payload: any) {
    const email = dto.email.toLowerCase();

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const user: User = await this.userRepository.save({
      email,
      name: dto.name,
      password: await bcrypt.hash(dto.password, 12),
      isActive: true,
    });

    const trackingId = await this.baseAuthService.createLoginTracking(
      user,
      payload,
    );

    return this.finalizeSession(user, payload, trackingId);
  }

  async login(dto: LoginDto, payload: any) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    const { trackingId } = await this.baseAuthService.passwordLogin(
      user,
      dto.password,
      payload,
    );

    return this.finalizeSession(user, payload, trackingId);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new NotFoundException('Account not found');
    }
    await this.baseAuthService.forGotPassword(user, 'user');
  }

  async verifyOtp(dto: VerifyOtpDto) {
    return this.baseAuthService.verifyOtp(
      dto.email.toLowerCase(),
      dto.code,
      'user',
    );
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new NotFoundException('Account not found');
    }
    await this.baseAuthService.resetPassword(
      user,
      dto.token,
      dto.password,
      'user',
      this.userRepository,
    );
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    const hasPassword = user.password?.startsWith('$2');
    if (hasPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required');
      }
      const matched = await bcrypt.compare(dto.currentPassword, user.password);
      if (!matched) {
        throw new BadRequestException('Current password is incorrect');
      }
    }

    await this.userRepository.update(userId, {
      password: await bcrypt.hash(dto.newPassword, 12),
    });
  }

  async logout(user: any) {
    await this.baseAuthService.kickLogin(user, user.trackingId, 'user');
  }

  async refreshToken(
    refreshToken: string,
    ctx: { ip?: string; userAgent?: string },
  ) {
    return this.baseAuthService.refreshToken(refreshToken, 'user', {
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  private finalizeSession(user: any, payload: any, trackingId: string) {
    const tokens = this.baseAuthService._createToken({
      id: user.id,
      scope: payload.scope,
      trackingId: trackingId,
    });
    return { tokens };
  }
}
