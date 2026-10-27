import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_SEARCH_LENGTH
} from "../utils/validation.js";

// OpenAPI 3.0 description of the WorkHub API. It is plain data (no
// annotations scattered across controllers) and is checked against the real
// Express routers by tests/docs.test.ts, so it cannot silently drift.

type Obj = Record<string, unknown>;

const ref = (name: string): Obj => ({ $ref: `#/components/schemas/${name}` });
const objectId: Obj = { type: "string", pattern: "^[a-fA-F0-9]{24}$", example: "64b0f1a2c3d4e5f6a7b8c9d0" };
const dateTime: Obj = { type: "string", format: "date-time" };

const jsonBody = (schema: Obj, required = true): Obj => ({
  required,
  content: { "application/json": { schema } }
});

const envelope = (data: Obj): Obj => ({
  type: "object",
  required: ["success", "data"],
  properties: { success: { type: "boolean", example: true }, data }
});

const ok = (description: string, data: Obj, status = "200"): Obj => ({
  [status]: {
    description,
    content: { "application/json": { schema: envelope(data) } }
  }
});

const paginated = (description: string, item: string): Obj => ({
  "200": {
    description,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["success", "data", "pagination"],
          properties: {
            success: { type: "boolean", example: true },
            data: { type: "array", items: ref(item) },
            pagination: ref("Pagination")
          }
        }
      }
    }
  }
});

const errorMessages: Record<string, string> = {
  "400": "Validation failed, malformed JSON or an invalid ID",
  "401": "Missing, invalid or expired access token",
  "403": "Authenticated but not allowed to perform this action",
  "404": "Resource not found",
  "409": "Conflict with existing data",
  "413": "Request body is larger than 100kb",
  "429": "Rate limit exceeded"
};

const errors = (...codes: string[]): Obj =>
  Object.fromEntries(
    codes.map((code) => [
      code,
      {
        description: errorMessages[code],
        content: { "application/json": { schema: ref("Error") } }
      }
    ])
  );

const pathParam = (name: string, description: string): Obj => ({
  name,
  in: "path",
  required: true,
  description,
  schema: objectId
});

const query = (name: string, schema: Obj, description: string): Obj => ({
  name,
  in: "query",
  required: false,
  description,
  schema
});

const bearer = [{ bearerAuth: [] }];

const projectIdParam = pathParam("projectId", "Project ID");
const taskIdParam = pathParam("taskId", "Task ID");
const pageParam = query("page", { type: "integer", minimum: 1, default: 1 }, "1-based page number (whole numbers only)");
const limitParam = (def: number) =>
  query("limit", { type: "integer", minimum: 1, maximum: 100, default: def }, "Page size");

const taskStatus: Obj = { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] };
const taskPriority: Obj = { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] };
const memberRole: Obj = { type: "string", enum: ["MEMBER", "PROJECT_MANAGER"] };

const statusCounts = {
  total: { type: "integer" },
  completed: { type: "integer" },
  inProgress: { type: "integer" },
  todo: { type: "integer" }
};

export const openApiSpec: Obj = {
  openapi: "3.0.3",
  info: {
    title: "WorkHub API",
    version: "1.0.0",
    description:
      "Project management API. Authenticate with `POST /api/auth/login`, then send " +
      "`Authorization: Bearer <accessToken>`. Access tokens last 15 minutes; use " +
      "`POST /api/auth/refresh` (refresh tokens rotate and are single-use). " +
      "Errors always use `{ \"success\": false, \"message\": \"...\" }`."
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Projects" },
    { name: "Members" },
    { name: "Tasks" },
    { name: "Comments" },
    { name: "Activity" },
    { name: "Dashboard" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
    },
    schemas: {
      Error: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Invalid project ID" }
        }
      },
      Pagination: {
        type: "object",
        required: ["page", "limit", "total", "totalPages"],
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" }
        }
      },
      User: {
        type: "object",
        properties: {
          id: objectId,
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["ADMIN", "PROJECT_MANAGER", "MEMBER"] },
          createdAt: dateTime,
          updatedAt: dateTime
        }
      },
      Project: {
        type: "object",
        properties: {
          id: objectId,
          name: { type: "string" },
          description: { type: "string" },
          ownerId: { ...objectId, description: "Owner's user ID, stored as a string" },
          status: { type: "string", enum: ["active", "archived"] },
          createdAt: dateTime,
          updatedAt: dateTime
        }
      },
      Task: {
        type: "object",
        properties: {
          id: objectId,
          title: { type: "string" },
          description: { type: "string" },
          projectId: objectId,
          assignedTo: { ...objectId, description: "Omitted when unassigned" },
          createdBy: objectId,
          status: taskStatus,
          priority: taskPriority,
          dueDate: { ...dateTime, description: "Omitted when not set" },
          createdAt: dateTime,
          updatedAt: dateTime
        }
      },
      TaskComment: {
        type: "object",
        properties: {
          id: objectId,
          projectId: objectId,
          taskId: objectId,
          userId: objectId,
          message: { type: "string" },
          createdAt: dateTime,
          updatedAt: dateTime
        }
      },
      TaskActivity: {
        type: "object",
        properties: {
          id: objectId,
          projectId: objectId,
          taskId: objectId,
          userId: { ...objectId, description: "User who performed the action" },
          action: {
            type: "string",
            enum: ["TASK_CREATED", "TASK_UPDATED", "STATUS_CHANGED", "ASSIGNEE_CHANGED", "TASK_DELETED"]
          },
          message: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
          createdAt: dateTime
        }
      },
      ProjectMember: {
        type: "object",
        properties: {
          id: objectId,
          projectId: objectId,
          user: {
            type: "object",
            properties: { id: objectId, name: { type: "string" }, email: { type: "string", format: "email" } }
          },
          role: memberRole,
          createdAt: dateTime
        }
      },
      ProjectMembershipCreated: {
        type: "object",
        description: "Raw membership document as stored (note `_id`, not `id`).",
        properties: {
          _id: objectId,
          projectId: objectId,
          userId: objectId,
          role: memberRole,
          createdAt: dateTime,
          updatedAt: dateTime,
          __v: { type: "integer" }
        }
      },
      ProjectMembershipUpdated: {
        type: "object",
        properties: { id: objectId, projectId: objectId, userId: objectId, role: memberRole, updatedAt: dateTime }
      },
      ProjectStats: {
        type: "object",
        properties: {
          projectId: objectId,
          summary: {
            type: "object",
            properties: {
              ...statusCounts,
              highPriority: { type: "integer" },
              overdue: {
                type: "integer",
                description: "dueDate is in the past and status is not DONE; tasks without a dueDate are never overdue"
              }
            }
          },
          tasksByAssignee: {
            type: "array",
            items: {
              type: "object",
              properties: {
                assigneeId: objectId,
                assigneeName: { type: "string", nullable: true },
                ...statusCounts
              }
            }
          },
          unassigned: { type: "object", properties: statusCounts }
        }
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", maxLength: MAX_NAME_LENGTH },
          email: { type: "string", format: "email", maxLength: MAX_EMAIL_LENGTH },
          password: { type: "string", minLength: 6, maxLength: MAX_PASSWORD_LENGTH }
        }
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: { email: { type: "string", format: "email" }, password: { type: "string" } }
      },
      RefreshRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: { refreshToken: { type: "string" } }
      },
      TokenPair: {
        type: "object",
        properties: { accessToken: { type: "string" }, refreshToken: { type: "string" } }
      },
      CreateProjectRequest: {
        type: "object",
        required: ["name", "description"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 150 },
          description: { type: "string", minLength: 1, maxLength: 2000 }
        }
      },
      UpdateProjectRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          name: { type: "string", minLength: 1, maxLength: 150 },
          description: { type: "string", minLength: 1, maxLength: 2000 },
          status: { type: "string", enum: ["active", "archived"] }
        }
      },
      CreateTaskRequest: {
        type: "object",
        required: ["title", "description"],
        properties: {
          title: { type: "string", minLength: 3, maxLength: 150 },
          description: { type: "string", minLength: 1, maxLength: 2000 },
          assignedTo: { ...objectId, description: "Must be the project owner or a member" },
          status: { ...taskStatus, default: "TODO" },
          priority: { ...taskPriority, default: "MEDIUM" },
          dueDate: { ...dateTime, description: "ISO datetime, e.g. 2030-01-31T17:00:00.000Z" }
        }
      },
      UpdateTaskRequest: {
        type: "object",
        minProperties: 1,
        description:
          "Unknown fields are rejected. Project managers/owners/admins may change any field; " +
          "the assigned member may send only `status`.",
        properties: {
          title: { type: "string", minLength: 3, maxLength: 150 },
          description: { type: "string", minLength: 1, maxLength: 2000 },
          assignedTo: { ...objectId, nullable: true, description: "null unassigns the task" },
          status: taskStatus,
          priority: taskPriority,
          dueDate: { ...dateTime, nullable: true, description: "null clears the due date" }
        }
      },
      AddMemberRequest: {
        type: "object",
        required: ["userId"],
        properties: { userId: objectId, role: { ...memberRole, default: "MEMBER" } }
      },
      UpdateMemberRoleRequest: {
        type: "object",
        required: ["role"],
        properties: { role: memberRole }
      },
      CreateCommentRequest: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string", minLength: 1, maxLength: 2000 } }
      }
    }
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness and database readiness",
        responses: {
          "200": {
            description: "API is running and the database is connected",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" }, message: { type: "string" } }
                }
              }
            }
          },
          "503": {
            description: "Database is not connected",
            content: { "application/json": { schema: ref("Error") } }
          }
        }
      }
    },

    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new MEMBER account",
        requestBody: jsonBody(ref("RegisterRequest")),
        responses: { ...ok("Account created", ref("User"), "201"), ...errors("400", "409", "413", "429") }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in and receive an access and refresh token",
        requestBody: jsonBody(ref("LoginRequest")),
        responses: {
          ...ok("Logged in", {
            type: "object",
            properties: { user: ref("User"), accessToken: { type: "string" }, refreshToken: { type: "string" } }
          }),
          ...errors("400", "401", "429")
        }
      }
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Exchange a refresh token for a new token pair",
        description: "The submitted refresh token is revoked; reusing it returns 401.",
        requestBody: jsonBody(ref("RefreshRequest")),
        responses: { ...ok("New token pair", ref("TokenPair")), ...errors("400", "401", "429") }
      }
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revoke a refresh token",
        requestBody: jsonBody(ref("RefreshRequest")),
        responses: {
          ...ok("Logged out", { type: "object", properties: { message: { type: "string" } } }),
          ...errors("400", "401", "429")
        }
      }
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user",
        security: bearer,
        responses: { ...ok("The authenticated user", ref("User")), ...errors("401", "404") }
      }
    },

    "/api/projects": {
      get: {
        tags: ["Projects"],
        summary: "List projects you own or belong to (admins see all)",
        security: bearer,
        parameters: [
          pageParam,
          limitParam(10),
          query("search", { type: "string", maxLength: MAX_SEARCH_LENGTH }, "Case-insensitive match on name or description; matched literally"),
          query("status", { type: "string", enum: ["active", "archived"] }, "Filter by status"),
          query("sortBy", { type: "string", enum: ["name", "createdAt", "updatedAt"], default: "createdAt" }, "Sort field"),
          query("sortOrder", { type: "string", enum: ["asc", "desc"], default: "desc" }, "Sort direction")
        ],
        responses: { ...paginated("A page of projects", "Project"), ...errors("400", "401") }
      },
      post: {
        tags: ["Projects"],
        summary: "Create a project (ADMIN or PROJECT_MANAGER role)",
        security: bearer,
        requestBody: jsonBody(ref("CreateProjectRequest")),
        responses: { ...ok("Project created; the caller becomes the owner", ref("Project"), "201"), ...errors("400", "401", "403") }
      }
    },
    "/api/projects/{id}": {
      parameters: [pathParam("id", "Project ID")],
      get: {
        tags: ["Projects"],
        summary: "Get a project (owner, member or admin)",
        security: bearer,
        responses: { ...ok("The project", ref("Project")), ...errors("400", "401", "403", "404") }
      },
      patch: {
        tags: ["Projects"],
        summary: "Update a project (project owner with ADMIN or PROJECT_MANAGER role)",
        security: bearer,
        requestBody: jsonBody(ref("UpdateProjectRequest")),
        responses: {
          ...ok("Updated project", ref("Project")),
          ...errors("400", "401", "403"),
          "404": { description: "Not found, or you are not the owner", content: { "application/json": { schema: ref("Error") } } }
        }
      },
      delete: {
        tags: ["Projects"],
        summary: "Delete a project (project owner with ADMIN or PROJECT_MANAGER role)",
        security: bearer,
        responses: {
          ...ok("Deleted", { type: "object", properties: { message: { type: "string" } } }),
          ...errors("400", "401", "403"),
          "404": { description: "Not found, or you are not the owner", content: { "application/json": { schema: ref("Error") } } }
        }
      }
    },

    "/api/projects/{projectId}/members": {
      parameters: [projectIdParam],
      get: {
        tags: ["Members"],
        summary: "List project members",
        security: bearer,
        responses: { ...ok("Members", { type: "array", items: ref("ProjectMember") }), ...errors("400", "401", "403", "404") }
      },
      post: {
        tags: ["Members"],
        summary: "Add a member (owner, project manager or admin)",
        security: bearer,
        requestBody: jsonBody(ref("AddMemberRequest")),
        responses: { ...ok("Member added", ref("ProjectMembershipCreated"), "201"), ...errors("400", "401", "403", "404", "409") }
      }
    },
    "/api/projects/{projectId}/members/{userId}": {
      parameters: [projectIdParam, pathParam("userId", "User ID of the member")],
      delete: {
        tags: ["Members"],
        summary: "Remove a member",
        security: bearer,
        responses: {
          ...ok("Member removed", {
            type: "object",
            properties: { projectId: objectId, userId: objectId, message: { type: "string" } }
          }),
          ...errors("400", "401", "403", "404")
        }
      }
    },
    "/api/projects/{projectId}/members/{userId}/role": {
      parameters: [projectIdParam, pathParam("userId", "User ID of the member")],
      patch: {
        tags: ["Members"],
        summary: "Change a member's role (owner or admin only)",
        security: bearer,
        requestBody: jsonBody(ref("UpdateMemberRoleRequest")),
        responses: { ...ok("Role updated", ref("ProjectMembershipUpdated")), ...errors("400", "401", "403", "404") }
      }
    },

    "/api/projects/{projectId}/tasks": {
      parameters: [projectIdParam],
      get: {
        tags: ["Tasks"],
        summary: "List and search tasks in a project",
        description: "All filters combine with AND. Results never include tasks from other projects.",
        security: bearer,
        parameters: [
          pageParam,
          limitParam(10),
          query("search", { type: "string", maxLength: MAX_SEARCH_LENGTH }, "Case-insensitive match on title or description; matched literally"),
          query("status", taskStatus, "Filter by status"),
          query("priority", taskPriority, "Filter by priority"),
          query("assignedTo", objectId, "Filter by assignee user ID"),
          query("overdue", { type: "boolean" }, "`true` returns tasks past their due date that are not DONE; `false` applies no filter"),
          query("sortBy", { type: "string", enum: ["createdAt", "updatedAt", "title"], default: "createdAt" }, "Sort field"),
          query("sortOrder", { type: "string", enum: ["asc", "desc"], default: "desc" }, "Sort direction")
        ],
        responses: { ...paginated("A page of tasks", "Task"), ...errors("400", "401", "403", "404") }
      },
      post: {
        tags: ["Tasks"],
        summary: "Create a task (any project member)",
        security: bearer,
        requestBody: jsonBody(ref("CreateTaskRequest")),
        responses: { ...ok("Task created", ref("Task"), "201"), ...errors("400", "401", "403", "404") }
      }
    },
    "/api/projects/{projectId}/tasks/{taskId}": {
      parameters: [projectIdParam, taskIdParam],
      get: {
        tags: ["Tasks"],
        summary: "Get a task",
        security: bearer,
        responses: { ...ok("The task", ref("Task")), ...errors("400", "401", "403", "404") }
      },
      patch: {
        tags: ["Tasks"],
        summary: "Update a task",
        security: bearer,
        requestBody: jsonBody(ref("UpdateTaskRequest")),
        responses: { ...ok("Updated task", ref("Task")), ...errors("400", "401", "403", "404") }
      },
      delete: {
        tags: ["Tasks"],
        summary: "Delete a task (owner, project manager or admin)",
        security: bearer,
        responses: {
          ...ok("Deleted", { type: "object", properties: { message: { type: "string" } } }),
          ...errors("400", "401", "403", "404")
        }
      }
    },

    "/api/projects/{projectId}/tasks/{taskId}/comments": {
      parameters: [projectIdParam, taskIdParam],
      get: {
        tags: ["Comments"],
        summary: "List comments on a task",
        security: bearer,
        responses: { ...ok("Comments", { type: "array", items: ref("TaskComment") }), ...errors("400", "401", "403", "404") }
      },
      post: {
        tags: ["Comments"],
        summary: "Comment on a task (any project member)",
        security: bearer,
        requestBody: jsonBody(ref("CreateCommentRequest")),
        responses: { ...ok("Comment created", ref("TaskComment"), "201"), ...errors("400", "401", "403", "404") }
      }
    },
    "/api/projects/{projectId}/tasks/{taskId}/activities": {
      parameters: [projectIdParam, taskIdParam],
      get: {
        tags: ["Activity"],
        summary: "Audit log for a task, newest first",
        security: bearer,
        parameters: [pageParam, limitParam(10)],
        responses: {
          ...ok("A page of activity entries", {
            type: "object",
            properties: {
              activities: { type: "array", items: ref("TaskActivity") },
              total: { type: "integer" },
              page: { type: "integer" },
              limit: { type: "integer" },
              totalPages: { type: "integer" }
            }
          }),
          ...errors("400", "401", "403", "404")
        }
      }
    },

    "/api/projects/{projectId}/stats": {
      parameters: [projectIdParam],
      get: {
        tags: ["Dashboard"],
        summary: "Task statistics for a project",
        security: bearer,
        responses: { ...ok("Aggregated statistics", ref("ProjectStats")), ...errors("400", "401", "403", "404") }
      }
    }
  }
};
