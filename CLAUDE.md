# Claude Code Metaprompt: Script Bud

You are taking over development of **Script Bud**, an AI-powered screenplay generation and management web application built with a modern React/Next.js stack.

## 1. Project Overview & Vision
Script Bud transforms narrative summaries (transcriptions) into professional screenplays using AI. It utilizes a custom **Fractal Story Structure (27-Chapter Method, 3 Acts > 9 Scenes > 27 Bits)** instead of traditional 4-act formats.

**Core Workflows:**
1.  **Ingestion**: User uploads a transcript/summary.
2.  **Structuring (AI)**: The script generates a JSON array of 27 "Beats" containing sluglines, characters, and actions.
3.  **Visualization (Board)**: Interactive corkboard UI to preview and manage the beats using color-coding based on type (Action, Dialogue, Transition, Turning Point).
4.  **Editor (Fountain)**: A fully-fledged Monaco text editor with custom syntax highlighting (`fountain-lang`) that auto-syncs to Notion.
5.  **Evaluation**: AI checks the script against 25 specific checkpoints.
6.  **Export**: Generate PDF (with title pages) and `.fountain` files.

## 2. Tech Stack Setup (IMPORTANT)
**Do not deviate from these.**
*   **Framework**: Next.js 16.2.1 (App Router) + React 19.
*   **Styling**: Tailwind CSS v4. **CRITICAL:** Use semantic CSS variables defined in `app/globals.css` (e.g., `bg-background`, `text-foreground`, `bg-muted`, `border-border`). Do not use hardcoded hex values or outdated utility classes like `bg-gray-900`.
*   **Theming**: `next-themes` (Dark/Light mode native via `ThemeProvider`). Wait for hydration, so remember to add `suppressHydrationWarning` on `html` and `body` tags in `layout.tsx` when making DOM structural changes.
*   **Editor**: Monaco Editor (`@monaco-editor/react`) configured with light (`fountain-light`) and dark (`fountain-dark`) themes.
*   **Drag and Drop**: `@dnd-kit/core` with custom hooks for the Board UI.
*   **Auth**: `next-auth` (Google Provider) with Edge middleware protection.
*   **Database/Storage**: Notion API.
*   **AI**: OpenAI API (GPT-4o) and Replicate API (for image/storyboard generation).
*   **PDF Generation**: `pdfmake` (Caution: Load dynamically or catch `vfs` assignment errors to avoid frozen module crashes in strict ESM React 19/Next 15+).

## 3. Architecture & Directory Rules
The application resides in `/app/` (Next.js root directory).
*   `app/api/...`: Next.js Route Handlers. Use proper HTTP verbs (GET, POST).
*   `app/dashboard/page.tsx`: Project list (requires Auth).
*   `app/dashboard/[projectId]/editor/page.tsx`: The Monaco editor and AI prompt interface.
*   `app/dashboard/[projectId]/board/page.tsx`: The visual corkboard UI for the 27 bits.
*   `components/...`: Reusable UI components (e.g., `theme-toggle.tsx`).
*   `lib/...`: Shared logic (`notion.ts`, `openai.ts`, `types.ts`, `guion-processor.ts`, `replicate.ts`).

## 4. Current State (What is already built)
*   **Authentication**: Google OAuth is active via `next-auth`. Users hitting `/dashboard` are redirected to `/` if unauthenticated. The Landing Page uses `signIn("google", { callbackUrl: "/dashboard" })`.
*   **UI/Aesthetic**: Minimalist "Notion/Figma" aesthetic. Completely driven by CSS variables spanning light and dark modes. The Landing Page, Dashboard, Board, and Editor are all styled.
*   **Editor Page**: Monaco is configured for Fountain with custom Monarch tokenizer rules. It has mocked fallback actions.
*   **Board Page**: Configured with 27 mock beats. The nested structure (Acts -> Scenes -> Beats) works.
*   **PDF Export**: Works smoothly with a Title Page and correct formatting.

## 5. Pending Development Roadmap (Your Tasks)
Your goal is to connect the beautiful UI to the actual backend logic.
1.  **Notion API Synchronization**:
    *   Implement CRUD in `/api/notion/projects/route.ts` using the `@notionhq/client`.
    *   Hook up the editor's auto-save (debounce) to update the Notion `SCENES` or `PROJECTS` tables.
2.  **OpenAI Script Generation**:
    *   Implement `/api/guion/generate/route.ts` to take a transcription, ask OpenAI to generate a JSON with 27 narrative beats (using the `guion-processor.ts` logic), and convert it to Fountain text.
3.  **OpenAI Evaluation (Feedback Module)**:
    *   Implement `/api/guion/evaluate/route.ts` to score the script out of 5 across different dimensions.
4.  **Replicate Image Generation**:
    *   Implement the "Generar Imagen" button on the Board page BeatCards to call a Replicate model and return storyboards.
5.  **Dnd-Kit Drag and Drop Logic**:
    *   The Board visualizes drops, but you need to ensure reording Beats in the Board updates the corresponding Fountain text in the Editor.

## 6. Execution Guidelines
*   **Files**: Treat `lib/types.ts` as the source of truth for interfaces (`Beat`, `Project`).
*   **Errors**: Next 16/React 19 are very strict. If you see hydration errors, check `<ThemeProvider>`. If you see "cannot extend object" in third-party libraries (like pdfmake), ensure you wrap assignments in `try/catch` or use fallback logic.
*   **Aesthetics**: You are forbidden from degrading the UI. Keep margins wide, paddings thick (`p-6`), borders subtle (`border-border`), and components flat.
*   **Proactivity**: You have terminal access. When modifying an API route, test it with curl or `npm run dev` and check the browser.
*   **GitHub**: Changes should be committed to the `melgarejo-drp/script-bud` repo when major milestones are hit.

Begin by asking the user which specific feature from the *Pending Development Roadmap* they want to implement first, or run `npm run dev` to familiarize yourself with the current UI.
