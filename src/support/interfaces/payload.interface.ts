export interface JwtPayLoad {
  id: string;
  scope: string;
  trackingId: string;
  iat: number;
  exp: number;
}
