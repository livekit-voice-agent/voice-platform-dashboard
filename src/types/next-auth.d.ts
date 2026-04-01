import "next-auth";

declare module "next-auth" {
  interface Session {
    apiToken: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isSuperAdmin: boolean;
    };
  }

  interface User {
    apiToken?: string;
    isSuperAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    apiToken?: string;
    userId?: string;
    isSuperAdmin?: boolean;
  }
}
