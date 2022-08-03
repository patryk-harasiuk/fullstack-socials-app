export interface ValidatedUser {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
}

export type JwtPayload = {
  sub: number;
  email: string;
};

export interface RefreshTokenCookie {
  cookie: string;
  refreshToken: string;
}

export interface UserProperties {
  email: string;
  name: string;
  password: string;
}

export interface Cookies {
  accessTokenCookie: string;
  refreshTokenCookie: string;
}
