/* eslint-disable @typescript-eslint/no-empty-function */
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcryptjs from 'bcryptjs';
import { User } from 'src/api/users/entities/user.entity';
import { UsersService } from 'src/api/users/users.service';
import { PostgresErrorCode } from 'src/shared/database';

import {
  Cookies,
  RefreshTokenCookie,
  UserProperties,
  ValidatedUser,
} from './interfaces';

@Injectable()
export class AuthService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  public async register(user: UserProperties): Promise<User> {
    try {
      const hashedPassword = await this.createHash(user.password);

      const createdUser = await this.usersService.create({
        ...user,
        password: hashedPassword,
      });

      return createdUser;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation)
        throw new HttpException(
          'User with that email already exists',
          HttpStatus.BAD_REQUEST,
        );
    }
    throw new HttpException(
      'Something went wrong',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  public async login(userId: number, email: string): Promise<Cookies> {
    const [accessTokenCookie, refreshTokenCookie] = await Promise.all([
      this.createAccessTokenCookie(userId, email),
      this.createRefreshTokenCookie(userId, email),
    ]);

    await this.updateRefreshToken(userId, refreshTokenCookie.refreshToken);

    return { accessTokenCookie, refreshTokenCookie: refreshTokenCookie.cookie };
  }

  public async logout(userId: number): Promise<string[]> {
    await this.usersService.removeUserRefreshToken(userId);
    const clearedAccessTokenCookie =
      'Authentication=; HttpOnly; Path=/; Max-Age=0';
    const clearedRefreshTokenCookie = 'Refresh=; HttpOnly; Path=/; Max-Age=0';

    return [clearedAccessTokenCookie, clearedRefreshTokenCookie];
  }

  private async updateRefreshToken(
    userId: number,
    refreshToken: string,
  ): Promise<void> {
    const hash = await this.createHash(refreshToken);

    await this.usersService.updateUserRefreshToken(userId, hash);
  }

  private async validateHash(password: string, hash: string): Promise<boolean> {
    return bcryptjs.compare(password, hash);
  }

  public async createAccessTokenCookie(
    userId: number,
    email: string,
  ): Promise<string> {
    const jwtPayload = { email, sub: userId };

    const accessToken = await this.jwtService.signAsync(jwtPayload, {
      secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('ACCESS_TOKEN_EXPIRATION'),
    });

    const cookie = `Authentication=${accessToken}; HttpOnly; Path=/; Max-Age=${this.configService.get<string>(
      'ACCESS_TOKEN_EXPIRATION',
    )}`;

    return cookie;
  }

  private async createRefreshTokenCookie(
    userId: number,
    email: string,
  ): Promise<RefreshTokenCookie> {
    const jwtPayload = { email, sub: userId };

    const refreshToken = await this.jwtService.signAsync(jwtPayload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('REFRESH_TOKEN_EXPIRATION'),
    });

    const cookie = `Refresh=${refreshToken}; HttpOnly; Path=/; Max-Age=${this.configService.get<string>(
      'REFRESH_TOKEN_EXPIRATION',
    )}`;

    return {
      cookie,
      refreshToken,
    };
  }

  public async validateUser(
    email: string,
    password: string,
  ): Promise<ValidatedUser> {
    try {
      const user = await this.usersService.findOneByEmail(email);

      const isPasswordOk = await this.validateHash(password, user.password);

      if (isPasswordOk) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, refreshToken, ...result } = user;
        return result;
      }
      throw new HttpException(
        'Wrong credentials provided',
        HttpStatus.BAD_REQUEST,
      );
    } catch (error) {
      throw new HttpException(
        'Wrong credentials provided',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async createHash(data: string): Promise<string> {
    const hashedData = await bcryptjs.hash(data, 10);

    return hashedData;
  }
}
