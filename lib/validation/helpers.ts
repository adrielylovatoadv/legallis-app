import { NextResponse } from "next/server";
import type { z } from "zod";

export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): { data: z.infer<T>; error?: undefined } | { data?: undefined; error: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: NextResponse.json(
        { error: "Dados inválidos", details: result.error.flatten().fieldErrors },
        { status: 400 }
      ),
    };
  }
  return { data: result.data };
}
