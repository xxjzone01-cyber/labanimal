/**
 * @labanimal/enterprise 共享类型
 */

/** Prisma 客户端最小接口 */
export interface PrismaClient {
  offlineLicense: {
    findMany(args?: any): Promise<any[]>;
    create(args: any): Promise<any>;
    delete(args: any): Promise<any>;
    count(args?: any): Promise<number>;
  };
  user: {
    findUnique(args: any): Promise<any>;
  };
}

/** 用户上下文 */
export interface UserInfo {
  userId: string;
  email: string;
}

/** Enterprise 路由依赖注入 */
export interface EnterpriseDeps {
  prisma: PrismaClient;
  getUser: (c: any) => UserInfo;
}
