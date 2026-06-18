import { Controller, Get, Query, Res } from '@nestjs/common';
import { MediaService } from '../services/media.service';
import { BaseAuthService } from '../../support/services/base-auth.service';
import { AccessMediaDto } from '../dto/media.dto';

@Controller('media')
export class AccessController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly baseAuthService: BaseAuthService,
  ) {}

  @Get('access')
  async access(@Res() res, @Query() query: AccessMediaDto) {
    // const check = await this.baseAuthService.verifyAccessFile(
    //   query.token,
    //   query.key,
    // );
    // if (check) {
    //   const url = this.mediaService.getLinkMediaKey(query.key);
    //   return res.redirect(url);
    // } else {
    //   res.statusCode = 403;
    //   return res.send('permission');
    // }
  }
}
