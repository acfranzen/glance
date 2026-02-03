import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, logEvent } from "@/lib/db";

export interface CustomTheme {
  name: string;
  lightCss: string;
  darkCss: string;
  createdAt: string;
  updatedAt: string;
}

// GET - Retrieve the current custom theme
export async function GET() {
  try {
    const themeJson = getSetting("custom_theme");

    if (!themeJson) {
      return NextResponse.json({ theme: null });
    }

    const theme = JSON.parse(themeJson) as CustomTheme;
    return NextResponse.json({ theme });
  } catch (error) {
    console.error("Failed to get custom theme:", error);
    return NextResponse.json(
      { error: "Failed to get custom theme" },
      { status: 500 },
    );
  }
}

// POST - Save a custom theme
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, lightCss, darkCss } = body as {
      name: string;
      lightCss: string;
      darkCss: string;
    };

    if (!name || (!lightCss && !darkCss)) {
      return NextResponse.json(
        { error: "Name and at least one theme CSS are required" },
        { status: 400 },
      );
    }

    const existingThemeJson = getSetting("custom_theme");
    const now = new Date().toISOString();

    const theme: CustomTheme = {
      name,
      lightCss: lightCss || "",
      darkCss: darkCss || "",
      createdAt: existingThemeJson
        ? JSON.parse(existingThemeJson).createdAt
        : now,
      updatedAt: now,
    };

    setSetting("custom_theme", JSON.stringify(theme));
    logEvent("theme_saved", { name });

    return NextResponse.json({ theme, success: true });
  } catch (error) {
    console.error("Failed to save custom theme:", error);
    return NextResponse.json(
      { error: "Failed to save custom theme" },
      { status: 500 },
    );
  }
}

// DELETE - Remove the custom theme
export async function DELETE() {
  try {
    setSetting("custom_theme", "");
    logEvent("theme_deleted", {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete custom theme:", error);
    return NextResponse.json(
      { error: "Failed to delete custom theme" },
      { status: 500 },
    );
  }
}
