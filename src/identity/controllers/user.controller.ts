import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { JwtAuthGuard } from 'src/support/utils/jwt.guard';
import { UpdateProfileDto } from '../dto/auth.dto';

@Controller('user')
@UseGuards(new JwtAuthGuard('user'))
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Put('me')
  async updateMe(@Body() dto: UpdateProfileDto, @Req() req: any) {
    const user = await this.userService.updateProfile(req.user.id, dto);
    return {
      statusCode: 200,
      result: { ...user, scope: 'user' },
    };
  }
}
