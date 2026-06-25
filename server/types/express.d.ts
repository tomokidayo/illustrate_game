declare namespace Express {
  interface Request {
    user?: { id: string; username: string; isGuest?: boolean };
    token?: string;
  }
}
