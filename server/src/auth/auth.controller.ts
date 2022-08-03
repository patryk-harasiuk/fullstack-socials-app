import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from 'src/api/users/users.service';

import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import RequestWithUser from './interfaces/request-with-user.interface';

@Controller('/auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UsersService,
  ) {}

  @Post('/register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() request: RequestWithUser) {
    const { user } = request;

    const { accessTokenCookie, refreshTokenCookie } =
      await this.authService.login(user.id, user.email);

    request.res?.setHeader('Set-Cookie', [
      accessTokenCookie,
      refreshTokenCookie,
    ]);

    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('/logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: RequestWithUser, @Res() response: Response) {
    const userId = request.user.id;

    response.setHeader('Set-Cookie', await this.authService.logout(userId));
    return response.sendStatus(200);
  }

  @UseGuards(RefreshTokenGuard)
  @Get('/refresh')
  async refreshToken(@Req() request: RequestWithUser) {
    const user = request.user;

    const accessTokenCookie = await this.authService.createAccessTokenCookie(
      user.id,
      user.email,
    );

    request.res?.setHeader('Set-Cookie', accessTokenCookie);
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  authenticate(@Req() request: RequestWithUser) {
    // #TODO: create method like sanitizeUser for clearing user object
    const { password, ...user } = request.user;

    return user;
  }
}
