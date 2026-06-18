export interface JwtPayLoad {
  id: number;
  scope: string;
  trackingId: number;
  iat: number;
  exp: number;
}
