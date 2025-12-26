import { GET, POST } from "@/app/api/watchlist/route";
import { auth } from "@/auth";
import { db } from "@/db/schema";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/auth", () => {
  return {
    auth: vi.fn(),
  };
});

vi.mock("@/db/schema", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  watchlist: {},
}));

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

describe("Watchlist API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/watchlist", () => {
    test("returns 401 when user is not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const request = new NextRequest("http://localhost/api/watchlist");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    test("returns 401 when session exists but user id is missing", async () => {
      mockAuth.mockResolvedValue({ user: {} } as never);

      const request = new NextRequest("http://localhost/api/watchlist");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    test("returns watchlist items for authenticated user", async () => {
      const mockUserId = "user-123";
      const mockDate = new Date();
      const mockItems = [
        {
          id: "item-1",
          userId: mockUserId,
          contentId: 123,
          mediaType: "movie",
          status: "watching",
          createdAt: mockDate,
          updatedAt: mockDate,
        },
      ];

      mockAuth.mockResolvedValue({
        user: { id: mockUserId },
      } as never);

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockItems),
          }),
        }),
      });

      mockDb.select = mockSelect;

      const request = new NextRequest("http://localhost/api/watchlist");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0]).toMatchObject({
        id: "item-1",
        userId: mockUserId,
        contentId: 123,
        mediaType: "movie",
        status: "watching",
      });
      expect(data.items[0].createdAt).toBe(mockDate.toISOString());
      expect(data.items[0].updatedAt).toBe(mockDate.toISOString());
    });

    test("handles database errors gracefully", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user-123" },
      } as never);

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockRejectedValue(new Error("Database error")),
          }),
        }),
      });

      mockDb.select = mockSelect;

      const request = new NextRequest("http://localhost/api/watchlist");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("POST /api/watchlist", () => {
    test("returns 401 when user is not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);

      const request = new NextRequest("http://localhost/api/watchlist", {
        method: "POST",
        body: JSON.stringify({
          contentId: 123,
          mediaType: "movie",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    test("returns 400 for invalid input", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user-123" },
      } as never);

      const request = new NextRequest("http://localhost/api/watchlist", {
        method: "POST",
        body: JSON.stringify({
          contentId: -1,
          mediaType: "invalid",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid input");
      expect(data.details).toBeDefined();
    });

    test("returns 409 when item already exists in watchlist", async () => {
      const mockUserId = "user-123";
      mockAuth.mockResolvedValue({
        user: { id: mockUserId },
      } as never);

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "existing-item",
                userId: mockUserId,
                contentId: 123,
                mediaType: "movie",
              },
            ]),
          }),
        }),
      });

      mockDb.select = mockSelect;

      const request = new NextRequest("http://localhost/api/watchlist", {
        method: "POST",
        body: JSON.stringify({
          contentId: 123,
          mediaType: "movie",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Item already in watchlist");
    });

    test("successfully adds item to watchlist", async () => {
      const mockUserId = "user-123";
      const mockDate = new Date();
      const mockNewItem = {
        id: "new-item",
        userId: mockUserId,
        contentId: 456,
        mediaType: "tv",
        status: "watching",
        createdAt: mockDate,
        updatedAt: mockDate,
      };

      mockAuth.mockResolvedValue({
        user: { id: mockUserId },
      } as never);

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNewItem]),
        }),
      });

      mockDb.select = mockSelect;
      mockDb.insert = mockInsert;

      const request = new NextRequest("http://localhost/api/watchlist", {
        method: "POST",
        body: JSON.stringify({
          contentId: 456,
          mediaType: "tv",
          status: "watching",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item).toMatchObject({
        id: "new-item",
        userId: mockUserId,
        contentId: 456,
        mediaType: "tv",
        status: "watching",
      });
      expect(data.item.createdAt).toBe(mockDate.toISOString());
      expect(data.item.updatedAt).toBe(mockDate.toISOString());
    });

    test("defaults to 'watching' status when not provided", async () => {
      const mockUserId = "user-123";
      mockAuth.mockResolvedValue({
        user: { id: mockUserId },
      } as never);

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "new-item",
              userId: mockUserId,
              contentId: 789,
              mediaType: "movie",
              status: "watching",
            },
          ]),
        }),
      });

      mockDb.select = mockSelect;
      mockDb.insert = mockInsert;

      const request = new NextRequest("http://localhost/api/watchlist", {
        method: "POST",
        body: JSON.stringify({
          contentId: 789,
          mediaType: "movie",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.status).toBe("watching");
    });

    test("handles database errors during insert", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user-123" },
      } as never);

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      mockDb.select = mockSelect;
      mockDb.insert = mockInsert;

      const request = new NextRequest("http://localhost/api/watchlist", {
        method: "POST",
        body: JSON.stringify({
          contentId: 999,
          mediaType: "movie",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
