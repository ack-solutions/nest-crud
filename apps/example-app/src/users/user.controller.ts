import { Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Crud } from '@ackplus/nest-crud';
import type { Response } from 'express';
import { User } from '../database/entities/user.entity';
import { UserService } from './user.service';

@ApiTags('users')
@Crud({
  entity: User,
  path: 'users',
  // Soft-delete: DELETE marks `deletedAt` instead of removing the row, so the
  // restore / trash routes and the `withDeleted` / `onlyDeleted` flags are demoable.
  softDelete: true,
  // `password` and `auditLogs` are hidden on the entity via @CrudHidden(); you can
  // also hide per-controller here, e.g. hiddenFields: ['password'].
  routes: {
    findMany: { enabled: true },
    findAll: { enabled: true },
    counts: { enabled: true },
    findOne: { enabled: true },
    create: { enabled: true },
    createMany: { enabled: true },
    update: { enabled: true },
    updateMany: { enabled: true },
    delete: { enabled: true },
    deleteMany: { enabled: true },
    restore: { enabled: true },
    restoreMany: { enabled: true },
    deleteFromTrash: { enabled: true },
    deleteFromTrashMany: { enabled: true },
  },
})
export class UserController {
  constructor(public service: UserService) {}

  // Custom endpoints
  @Get('active')
  @ApiOperation({ 
    summary: 'Get all active users',
    description: 'Returns all users where isActive is true, including their posts'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of active users',
    type: [User]
  })
  async getActiveUsers(): Promise<User[]> {
    return this.service.findActiveUsers();
  }

  @Get('role/:role')
  @ApiOperation({ 
    summary: 'Get users by role',
    description: 'Returns all users with the specified role'
  })
  @ApiParam({ 
    name: 'role', 
    description: 'User role (e.g., admin, user, moderator)',
    example: 'admin'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of users with the specified role',
    type: [User]
  })
  async getUsersByRole(@Param('role') role: string): Promise<User[]> {
    return this.service.findByRole(role);
  }

  @Get('email/:email')
  @ApiOperation({ 
    summary: 'Get user by email',
    description: 'Returns a single user with the specified email address'
  })
  @ApiParam({ 
    name: 'email', 
    description: 'User email address',
    example: 'john@example.com'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User with the specified email',
    type: User
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found'
  })
  async getUserByEmail(@Param('email') email: string): Promise<User | null> {
    return this.service.findByEmail(email);
  }

  // Streaming export — reuses the same query as GET /users (where/relations/order/…)
  // but streams rows one-by-one as NDJSON, so large exports stay memory-safe.
  // Example: GET /users/export?where={"isActive":{"$eq":true}}&order={"createdAt":"DESC"}
  @Get('export')
  @ApiOperation({
    summary: 'Stream all matching users as NDJSON',
    description:
      'Same query params as GET /users, but streams the rows one-by-one as ' +
      'newline-delimited JSON (application/x-ndjson). Memory-safe for large exports.',
  })
  async exportUsers(@Query() query: Record<string, any>, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users.ndjson"');
    try {
      for await (const user of this.service.exportAll(query)) {
        res.write(JSON.stringify(user) + '\n'); // one row per line
      }
      res.end();
    } catch (err) {
      // headers are already sent mid-stream, so abort the connection on error
      res.destroy(err as Error);
    }
  }
}

