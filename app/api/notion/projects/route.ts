import { NextRequest, NextResponse } from "next/server";
import {
  getProjects,
  createProject,
  getProject,
  updateProjectGuion,
  getVersionsForProject,
  createVersion,
} from "@/lib/notion";
import type { ProjectGenre, ProjectFormat } from "@/lib/types";

// GET /api/notion/projects — list all projects
export async function GET(request: NextRequest) {
  try {
    const projects = await getProjects();
    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    // If Notion isn't configured, return empty array (dev fallback)
    console.warn("[/api/notion/projects GET]", error.message);
    return NextResponse.json({ success: true, projects: [] });
  }
}

// POST /api/notion/projects — create project or sync guion
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const { title, description, genre, format, duration } = body;
        const project = await createProject({
          title,
          description,
          genre: genre as ProjectGenre,
          format: format as ProjectFormat,
          duration: duration || 10,
        });
        return NextResponse.json({ success: true, project });
      }

      case "sync": {
        const { projectId, content, metadata } = body;
        await updateProjectGuion(projectId, content);
        return NextResponse.json({
          success: true,
          syncedAt: new Date().toISOString(),
        });
      }

      case "createVersion": {
        const { projectId, versionNumber, author, guionSnapshot, summaryOfChanges } = body;
        const versionId = await createVersion({
          projectId,
          versionNumber,
          author: author || "Script Bud User",
          guionSnapshot,
          summaryOfChanges,
        });
        return NextResponse.json({ success: true, versionId });
      }

      case "getVersions": {
        const { projectId } = body;
        const versions = await getVersionsForProject(projectId);
        return NextResponse.json({ success: true, versions });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[/api/notion/projects POST]", error);
    return NextResponse.json(
      { error: error.message || "Notion operation failed" },
      { status: 500 }
    );
  }
}
