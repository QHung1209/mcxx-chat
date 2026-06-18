import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { UpdateProfileDto } from '../dto/auth.dto';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email', 'avatarMediaId'],
      relations: ['avatar'],
    });
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    const patch: { name?: string; avatarMediaId?: string } = {};
    if (dto.name) patch.name = dto.name;
    if (dto.mediaId) patch.avatarMediaId = dto.mediaId;

    if (Object.keys(patch).length) {
      await this.userRepository.update(userId, patch);
    }

    return this.getUserById(userId);
  }
}
