import { auth } from "@/auth";
import { db, users } from "@/db/schema";
import { isAllowedAvatar } from "@/lib/user/avatar";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateProfileSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must be less than 100 characters")
      .optional(),
    image: z.string().optional(),
  })
  .refine((data) => data.name !== undefined || data.image !== undefined, {
    message: "At least one field is required",
  });

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    if (
      validatedData.image !== undefined &&
      !isAllowedAvatar(validatedData.image)
    ) {
      return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
    }

    const updates: { name?: string; image?: string } = {};
    if (validatedData.name !== undefined) {
      updates.name = validatedData.name.trim();
    }
    if (validatedData.image !== undefined) {
      updates.image = validatedData.image;
    }

    await db.update(users).set(updates).where(eq(users.id, session.user.id));

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    await db.transaction(async (tx) => {
      await tx.delete(users).where(eq(users.id, userId));
    });

    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting user account:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
