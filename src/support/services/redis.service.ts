import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class RedisService {
  private readonly redisKey = 'block';
  private readonly shardSize = 1_000_000;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  private getShardAndOffset(trackingId: number) {
    const shard = Math.floor(trackingId / this.shardSize);
    const offset = trackingId % this.shardSize;
    return { shard, offset };
  }

  private getUserIndex(trackingId: string): number {
    const hash = crypto.createHash('sha256').update(trackingId).digest('hex');
    return parseInt(hash.slice(0, 8), 16); // 32-bit index
  }

  async blockUser(trackingId, tokenExp: number, scope): Promise<void> {
    const { shard, offset } = this.getShardAndOffset(Number(trackingId));
    const key = `${this.redisKey}:${scope}:${shard}`;

    // 1) Set bit
    await this.redis.setbit(key, offset, 1);

    // Chỉ cập nhật TTL nếu expireAt mới > TTL hiện tại
    const luaScript = `
      local key = KEYS[1]
      local newExpireAt = tonumber(ARGV[1])
      local now = tonumber(ARGV[2])
      local ttl = redis.call('TTL', key)

      if ttl < 0 then
        redis.call('EXPIREAT', key, newExpireAt)
      else
        local currentExpireAt = now + ttl
        if currentExpireAt < newExpireAt then
          redis.call('EXPIREAT', key, newExpireAt)
        end
      end
      return 1
    `;
    const expireAt = tokenExp + 86400; // breaktime
    const now = Math.floor(Date.now() / 1000);
    await this.redis.eval(luaScript, 1, key, expireAt, now);
  }

  async isUserBlocked(trackingId: number, scope) {
    const { shard, offset } = this.getShardAndOffset(Number(trackingId));
    const key = `${this.redisKey}:${scope}:${shard}`;
    return this.redis.getbit(key, offset);
  }

  async set(key: string, value: string, ttl?: number): Promise<string> {
    if (ttl) {
      return this.redis.set(key, value, 'EX', Number(ttl));
    }
    return this.redis.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async delete(key: string) {
    await this.redis.del(key);
  }

  async sismember(key: string, value: string) {
    return this.redis.sismember(key, value);
  }

  async sadd(key: string, value: string[]) {
    return this.redis.sadd(key, ...value);
  }

  async exists(key: string) {
    return this.redis.exists(key);
  }

  async expire(key: string, ttl: number) {
    return this.redis.expire(key, ttl);
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  async hset(key: string, field: string, value: string) {
    return this.redis.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  async hkeys(key: string): Promise<string[]> {
    return this.redis.hkeys(key);
  }

  async hmset(key: string, data: Record<string, string>) {
    return this.redis.hset(key, data);
  }

  async hdel(key: string, field: string) {
    return this.redis.hdel(key, field);
  }

  async hIncrBy(key: string, field: string, increment: number): Promise<number> {
    return this.redis.hincrby(key, field, increment);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }
}
