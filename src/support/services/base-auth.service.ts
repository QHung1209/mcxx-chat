import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { PasswordResetRepository } from '../repositories/password-reset.repository';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AuthTrackingRepository } from '../repositories/auth-tracking.repository';
import { HttpService } from '@nestjs/axios';
import { JwtPayLoad } from '../interfaces/payload.interface';
import { RedisService } from './redis.service';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import { google } from 'googleapis';

@Injectable()
export class BaseAuthService {
  private oauthClient: any;
  constructor(
    private readonly configService: ConfigService,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly httpService: HttpService,
    private readonly authTrackingRepository: AuthTrackingRepository,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly i18n: I18nService,

    @InjectQueue('send-email-queue')
    private readonly emailQueue: Queue,
  ) {}

  async login(user, password, payload, permissions = false) {
    if (
      !user ||
      !user.password ||
      !bcrypt.compareSync(password, user.password)
    ) {
      throw new HttpException(
        {
          message: this.i18n.t('base.LOGIN_FAILED'),
          statusCode: HttpStatus.UNAUTHORIZED,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (permissions) {
      await this.setPermission(payload.scope, user);
    }

    const trackingId = await this.createLoginTracking(user, payload);

    return this._createToken(
      {
        id: user.id,
        scope: payload.scope,
        trackingId: trackingId,
      },
      0,
    );
  }


  async passwordLogin(user, password, payload) {
    if (
      !user ||
      !user.password ||
      !bcrypt.compareSync(password, user.password)
    ) {
      throw new HttpException(
        {
          message: this.i18n.t('base.LOGIN_FAILED'),
          statusCode: HttpStatus.UNAUTHORIZED,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.isActive === false) {
      throw new HttpException(
        {
          message: this.i18n.t('base.ACCOUNT_NOT_FOUND'),
          statusCode: HttpStatus.UNAUTHORIZED,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const trackingId = await this.createLoginTracking(user, payload);

    return { user, trackingId };
  }


  async createLoginTracking(user, payload) {
    let result;
    try {
      result = await this.httpService.axiosRef.get(
        `http://ipinfo.io/${payload.ip}/json/`,
      );
    } catch (e) {
      result = { data: {} };
    }

    const tracking = await this.authTrackingRepository.save({
      userId: user.id,
      scope: payload.scope,
      userAgent: payload.userAgent,
      ip: payload.ip,
      type: AuthTrackingRepository.TYPE_LOGIN,
      location: result.data,
      refreshToken: [],
    });

    return tracking.id;
  }

  async googleLogin(code: string, url: string, payload, userRepo) {
    const clientID = this.configService.get('GOOGLE_AUTH_CLIENT_ID');
    const clientSecret = this.configService.get('GOOGLE_AUTH_CLIENT_SECRET');

    this.oauthClient = new google.auth.OAuth2(
      clientID,
      clientSecret,
      url ?? this.configService.get('FE_URL'),
    );
    const { tokens } = await this.oauthClient.getToken({
      code: code,
      redirect_uri: url,
    });

    return this.googleProfile(tokens.id_token, clientID, userRepo, payload);
  }

  async googleProfile(idToken, clientID, userRepo, payload) {
    let isNewUser = false;
    const data = await this.oauthClient.verifyIdToken({
      idToken: idToken,
      audience: clientID,
    });
    const info = data.getPayload();
    let filter = { where: { email: info?.email?.toLowerCase() } };

    let user = await userRepo.findOne(filter);
    if (!user) {
      user = await userRepo.save({
        email: info?.email?.toLowerCase(),
        name: info?.name ?? info?.email?.toLowerCase(),
        googleId: info?.sub,
        password: this.randomString(),
        isActive: true,
      });
      isNewUser = true;
    } else if (!user.googleId && info?.sub) {
      await userRepo.update(user.id, { googleId: info.sub });
      user.googleId = info.sub;
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    const trackingId = await this.createLoginTracking(user, payload);

    return {
      user: user,
      isNewUser,
      trackingId: trackingId,
      picture: info?.picture ?? null,
    };
  }

  async setPermission(scope, user) {
    let permissions = user.permissions ?? [];
    if (user.isAdmin) {
      permissions = 'isAdmin';
    }
    await this.redisService.set(
      `permissions:${scope}:${user.id}`,
      permissions.toString(),
      this.configService.get('EXPIRESIN'),
    );
  }

  async clearPermission(ids: string[], scope) {
    for (const id of ids) {
      await this.redisService.delete(`permissions:${scope}:${id}`);
    }
  }

  async trackingLogins(user: JwtPayLoad, scope) {
    return this.authTrackingRepository.find({
      where: {
        userId: user.id,
        scope: scope,
      },
      order: {
        id: 'DESC',
      },
    });
  }

  async kickLogin(user: JwtPayLoad, trackingId, scope) {
    const tracking = await this.authTrackingRepository.findOne({
      where: { id: trackingId, userId: user.id, scope: scope },
    });
    if (tracking) {
      await this.authTrackingRepository.delete({
        id: user.trackingId,
      });
      await this.redisService.blockUser(user.trackingId, user.exp, scope);
    }
  }

  async handleAuthMiddleware(authHeaders, scope) {
    try {
      const token = (authHeaders as string).split(' ')[1];
      const payload = jwt.verify(token, this.configService.get('SECRETKEY')!);
      if (payload['scope'] == scope) {
        return payload['id'];
      } else {
        throw 500;
      }
    } catch (e) {
      throw new HttpException(
        {
          message: this.i18n.t('base.INVALID_CREDENTIAL'),
          statusCode: HttpStatus.UNAUTHORIZED,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async refreshToken(refreshToken: string, scope, { ip, userAgent }) {
    const payload: any = jwt.verify(
      refreshToken,
      this.configService.get('SECRETKEY_REFRESH')!,
    );
    const tracking = await this.authTrackingRepository.findOneByOrFail({
      id: payload.trackingId,
      userId: payload.id,
      scope: payload.scope,
    });

    const isBlock = await this.redisService.isUserBlocked(tracking.id, scope);

    if (isBlock || !tracking || payload.code != tracking.refreshToken.length) {
      throw new HttpException(
        {
          message: this.i18n.t('base.INVALID_CREDENTIAL'),
          statusCode: HttpStatus.UNAUTHORIZED,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    tracking.refreshToken.push({
      ip: ip,
      userAgent: userAgent,
      createdAt: new Date(),
    });

    await this.authTrackingRepository.update(
      { id: tracking.id },
      {
        refreshToken: tracking.refreshToken,
      },
    );
    return this._createToken(
      {
        id: payload.id,
        trackingId: tracking.id,
        scope: scope,
      },
      tracking.refreshToken.length,
    );
  }

  async forGotPassword(user, scope, job = 'forgot-password-job') {
    const code = Math.floor(Math.random() * (999999 - 100000 + 1) + 100000);
    await this.passwordResetRepository.delete({
      email: user.email,
    });
    await this.passwordResetRepository.insert({
      email: user.email,
      scope: scope,
      code: String(code),
      try: 0,
    });
    return this.emailQueue.add(
      job,
      {
        user: user,
        code: code,
      },
      {
        removeOnComplete: true,
      },
    );
  }

  async verifyOtp(email, code: string, scope) {
    const checkOtp = await this.passwordResetRepository.findOneBy({
      email: email,
      scope: scope,
    });
    if (checkOtp && checkOtp.code == code) {
      if (
        Date.now() - new Date(checkOtp.createdAt).getTime() >
        10 * 60 * 1000
      ) {
        await this.passwordResetRepository.delete({
          email: email,
        });
        throw new HttpException(
          {
            message: this.i18n.t('base.OTP_EXPIRATION'),
            statusCode: HttpStatus.BAD_REQUEST,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      const token = this.randomString();
      await this.passwordResetRepository.update(
        { email: email },
        { code: token },
      );
      return {
        email: email,
        token: token,
      };
    } else {
      if (checkOtp) {
        if (checkOtp.try == 2) {
          await this.passwordResetRepository.delete({ email: email });
          throw new HttpException(
            {
              message: this.i18n.t('base.OTP_EXPIRATION'),
              statusCode: HttpStatus.BAD_REQUEST,
            },
            HttpStatus.BAD_REQUEST,
          );
        } else {
          await this.passwordResetRepository.update(
            { email: email },
            { try: checkOtp.try + 1 },
          );
        }
      }
      throw new HttpException(
        {
          message: this.i18n.t('base.OTP_NOT_MATCH'),
          statusCode: HttpStatus.BAD_REQUEST,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async resetPassword(user, token, password, scope, repo) {
    const checkOtp = await this.passwordResetRepository.findOneBy({
      email: user.email,
      scope: scope,
      code: token,
    });
    await this.passwordResetRepository.delete({ email: user.email });
    if (!checkOtp) {
      throw new HttpException(
        {
          message: this.i18n.t('base.INVALID_CREDENTIAL'),
          statusCode: HttpStatus.BAD_REQUEST,
        },
        HttpStatus.BAD_REQUEST,
      );
    } else {
      await repo.update(user.id, {
        password: await bcrypt.hash(password, 12),
      });
    }
  }

  private randomString() {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < 30; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  _createToken(payload, appendRefresh = 0) {
    const accessToken = this.jwtService.sign(payload);
    payload['code'] = appendRefresh;
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<number>('EXPIRESIN_REFRESH'),
      secret: this.configService.get<string>('SECRETKEY_REFRESH'),
    });
    return {
      accessToken,
      refreshToken,
    };
  }
}
