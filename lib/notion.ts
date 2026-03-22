// ─────────────────────────────────────────────────────────────
//  Script Bud — Notion Client Configuration
//  Source: metaprompt_maestro_antigravity.md, PARTE 4
// ─────────────────────────────────────────────────────────────

import { Client } from "@notionhq/client";
import type {
  Project,
  Scene,
  Version,
  GuionJSON,
  ProjectStatus,
  ProjectGenre,
  ProjectFormat,
} from "./types";

// Notion client singleton
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// Database IDs from env
const PROJECTS_DB = process.env.NOTION_DATABASE_ID_PROJECTS!;
const SCENES_DB = process.env.NOTION_DATABASE_ID_SCENES!;
const VERSIONS_DB = process.env.NOTION_DATABASE_ID_VERSIONS!;

// ── Projects ──────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  if (!PROJECTS_DB) {
    throw new Error("NOTION_DATABASE_ID_PROJECTS not configured");
  }

  const response = await notion.databases.query({
    database_id: PROJECTS_DB,
    sorts: [{ property: "Last Modified", direction: "descending" }],
    page_size: 20,
  });

  return response.results.map((page: any) =>
    notionPageToProject(page)
  );
}

export async function getProject(projectId: string): Promise<Project | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: projectId });
    return notionPageToProject(page as any);
  } catch {
    return null;
  }
}

export async function createProject(data: {
  title: string;
  description?: string;
  genre: ProjectGenre;
  format: ProjectFormat;
  duration: number;
}): Promise<Project> {
  const response = await notion.pages.create({
    parent: { database_id: PROJECTS_DB },
    properties: {
      Name: { title: [{ text: { content: data.title } }] },
      Genre: { select: { name: data.genre } },
      Format: { select: { name: data.format } },
      Duration: { number: data.duration },
      Status: { select: { name: "Draft" } },
      Description: {
        rich_text: [{ text: { content: data.description || "" } }],
      },
    },
  });

  return notionPageToProject(response as any);
}

export async function updateProjectGuion(
  projectId: string,
  guionText: string,
  guionJSON?: GuionJSON
): Promise<void> {
  const properties: any = {
    "Guion Text": {
      rich_text: [
        {
          text: {
            // Notion limits rich_text to 2000 chars per item
            content: guionText.slice(0, 2000),
          },
        },
      ],
    },
    "Last Modified": { date: { start: new Date().toISOString() } },
  };

  await notion.pages.update({
    page_id: projectId,
    properties,
  });
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<void> {
  await notion.pages.update({
    page_id: projectId,
    properties: {
      Status: { select: { name: status } },
      "Last Modified": { date: { start: new Date().toISOString() } },
    },
  });
}

// ── Scenes ────────────────────────────────────────────────────

export async function getScenesForProject(
  projectId: string
): Promise<Scene[]> {
  if (!SCENES_DB) return [];

  const response = await notion.databases.query({
    database_id: SCENES_DB,
    filter: {
      property: "Project",
      relation: { contains: projectId },
    },
    sorts: [{ property: "Scene Number", direction: "ascending" }],
  });

  return response.results.map((page: any) => notionPageToScene(page));
}

export async function upsertScene(scene: Scene, projectId: string): Promise<string> {
  const properties: any = {
    Name: { title: [{ text: { content: scene.slugline } }] },
    "Scene Number": { number: scene.sceneNumber },
    "Beat Number": { number: scene.beatNumber },
    Act: { select: { name: scene.act } },
    "Beat Type": { select: { name: scene.beatType } },
    Slugline: { rich_text: [{ text: { content: scene.slugline } }] },
    Action: { rich_text: [{ text: { content: scene.action.slice(0, 2000) } }] },
    Characters: {
      multi_select: scene.characters.map((c) => ({ name: c })),
    },
    "Duration Seconds": { number: scene.durationSeconds },
    "Narrative Function": { select: { name: scene.narrativeFunction } },
    Project: { relation: [{ id: projectId }] },
  };

  if (scene.imageUrl) {
    properties["Image"] = {
      files: [
        {
          name: "Scene Image",
          type: "external",
          external: { url: scene.imageUrl },
        },
      ],
    };
  }

  if (scene.notionPageId) {
    // Update existing
    await notion.pages.update({
      page_id: scene.notionPageId,
      properties,
    });
    return scene.notionPageId;
  } else {
    // Create new
    const response = await notion.pages.create({
      parent: { database_id: SCENES_DB },
      properties,
    });
    return response.id;
  }
}

// ── Versions ──────────────────────────────────────────────────

export async function createVersion(data: {
  projectId: string;
  versionNumber: string;
  author: string;
  guionSnapshot: string;
  summaryOfChanges: string;
  githubCommitHash?: string;
}): Promise<string> {
  if (!VERSIONS_DB) return "";

  const response = await notion.pages.create({
    parent: { database_id: VERSIONS_DB },
    properties: {
      Name: {
        title: [{ text: { content: `${data.versionNumber} — ${data.summaryOfChanges}` } }],
      },
      "Version Number": {
        rich_text: [{ text: { content: data.versionNumber } }],
      },
      Timestamp: { date: { start: new Date().toISOString() } },
      Author: {
        rich_text: [{ text: { content: data.author } }],
      },
      "Summary of Changes": {
        rich_text: [{ text: { content: data.summaryOfChanges } }],
      },
      "Guion Snapshot": {
        rich_text: [{ text: { content: data.guionSnapshot.slice(0, 2000) } }],
      },
      Project: { relation: [{ id: data.projectId }] },
      ...(data.githubCommitHash && {
        "GitHub Commit Hash": {
          rich_text: [{ text: { content: data.githubCommitHash } }],
        },
      }),
    },
  });

  return response.id;
}

export async function getVersionsForProject(
  projectId: string
): Promise<Version[]> {
  if (!VERSIONS_DB) return [];

  const response = await notion.databases.query({
    database_id: VERSIONS_DB,
    filter: {
      property: "Project",
      relation: { contains: projectId },
    },
    sorts: [{ property: "Timestamp", direction: "descending" }],
    page_size: 20,
  });

  return response.results.map((page: any): Version => {
    const props = page.properties;
    return {
      id: page.id,
      notionPageId: page.id,
      versionNumber: props["Version Number"]?.rich_text?.[0]?.text?.content || "v1.0",
      timestamp: props["Timestamp"]?.date?.start || page.created_time,
      author: props["Author"]?.rich_text?.[0]?.text?.content || "Unknown",
      guionSnapshot: props["Guion Snapshot"]?.rich_text?.[0]?.text?.content || "",
      summaryOfChanges:
        props["Summary of Changes"]?.rich_text?.[0]?.text?.content || "",
      githubCommitHash:
        props["GitHub Commit Hash"]?.rich_text?.[0]?.text?.content,
    };
  });
}

// ── Helpers: Notion Page → App Types ─────────────────────────

function notionPageToProject(page: any): Project {
  const props = page.properties;
  return {
    id: page.id,
    notionPageId: page.id,
    title: props?.Name?.title?.[0]?.text?.content || "Untitled",
    description: props?.Description?.rich_text?.[0]?.text?.content,
    genre: (props?.Genre?.select?.name as ProjectGenre) || "Drama",
    format: (props?.Format?.select?.name as ProjectFormat) || "Cortometraje (< 15 min)",
    duration: props?.Duration?.number || 0,
    status: (props?.Status?.select?.name as ProjectStatus) || "Draft",
    createdAt: page.created_time,
    lastModified: page.last_edited_time,
    guionText: props?.["Guion Text"]?.rich_text?.[0]?.text?.content,
    thumbnail: props?.Thumbnail?.files?.[0]?.external?.url || props?.Thumbnail?.files?.[0]?.file?.url || undefined,
  };
}

function notionPageToScene(page: any): Scene {
  const props = page.properties;
  return {
    id: props?.["Scene ID"]?.rich_text?.[0]?.text?.content || page.id,
    notionPageId: page.id,
    sceneNumber: props?.["Scene Number"]?.number || 0,
    beatNumber: props?.["Beat Number"]?.number || 0,
    act: props?.Act?.select?.name || "Acto 1",
    beatType: props?.["Beat Type"]?.select?.name || "Acción",
    narrativeFunction: props?.["Narrative Function"]?.select?.name || "Desarrollo",
    slugline: props?.Slugline?.rich_text?.[0]?.text?.content || "",
    action: props?.Action?.rich_text?.[0]?.text?.content || "",
    characters: (props?.Characters?.multi_select || []).map((c: any) => c.name),
    durationSeconds: props?.["Duration Seconds"]?.number || 0,
    imageUrl: props?.Image?.files?.[0]?.external?.url || props?.Image?.files?.[0]?.file?.url || undefined,
    imagePrompt: props?.["Image Prompt"]?.rich_text?.[0]?.text?.content,
    notes: props?.Notes?.rich_text?.[0]?.text?.content,
  };
}

export { notion };
