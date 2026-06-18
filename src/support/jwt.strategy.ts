import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayLoad } from './interfaces/payload.interface';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './services/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow('SECRETKEY'),
      ignoreExpiration: true,
      jsonWebTokenOptions: {
        ignoreNotBefore: true,
      },
    });
  }

  async validate(payload: JwtPayLoad) {
    if (payload.trackingId) {
      const isBlocked = await this.redisService.isUserBlocked(
        payload.trackingId,
        payload.scope,
      );
      if (isBlocked) {
        throw new HttpException(
          {
            key: 'UNAUTHORIZED',
            data: {},
            statusCode: HttpStatus.UNAUTHORIZED,
          },
          HttpStatus.UNAUTHORIZED,
        );
      }
    }
    return payload;
  }
}
