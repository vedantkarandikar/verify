# Verify

Verify is a multi-agent fact-checking application built with [Fluo](https://fluo.one). It is designed to help people, especially older generations, navigate the digital world safely by verifying the truthfulness of messages and posts they encounter online.

## How it Works

The application follows a pipeline where multiple AI agents collaborate to verify claims within a given text or URL, providing clear evidence for its findings.

### 1. API Key Protection Pattern
To ensure security, Verify uses **Next.js Route Handlers** (Server-side API routes) to interact with Fluo.
- The client-side UI sends requests to `/api/[agent-endpoint]`.
- The server-side route retrieves the `FLUO_API_KEY` and `FLUO_PROJECT_ID` from environment variables.
- The server-side route then makes the authorized request to the Fluo API and returns the result to the client.

This pattern prevents sensitive API keys from being exposed in the user's browser.

### 2. The Multi-Agent Orchestration
The fact-checking process is broken down into four distinct agentic steps:

#### **A. Claims Agent (`/api/claims`)**
- **Action:** Extracts specific, verifiable claims from the provided text or URL.
- **Role:** Breaks down complex content into individual statements that can be independently verified.

#### **B. Claim Verifier Agent (`/api/claim-verify`)**
- **Action:** Performs a deep search to find supporting or refuting evidence (snippets) for a specific claim.
- **Role:** Gathers the raw data needed to determine the truthfulness of a statement.

#### **C. Source Credibility Agent (`/api/source-cred`)**
- **Action:** Evaluates the reliability and bias of the domains/sources found by the verifier.
- **Role:** Adds a layer of "trust" assessment to the evidence gathered.

#### **D. Claim Assessment Agent (`/api/claim-assess`)**
- **Action:** Synthesizes the extracted snippets and source credibility to provide a final verdict (e.g., True, False, Misleading, Unverified).
- **Role:** Logical reasoning and final decision-making based on gathered evidence.

## Getting Started

### Prerequisites
- Node.js and npm/pnpm/yarn
- A [Fluo](https://fluo.one) account and API key.

### Environment Setup
Create a `.env` file in the root directory with the following variables:

```env
FLUO_API_KEY=your_api_key
FLUO_PROJECT_ID=your_project_id

# Agent IDs (Replace with your specific Fluo Agent IDs if different)
FLUO_AGENT_ID_CLAIMS=agent-0rpKkKttamHK9WnJaN
FLUO_AGENT_ID_VERIFIER=agent-2i2O86cbJPBmSygMQ9
FLUO_AGENT_ID_SOURCE_CRED=agent-ZIRfFcdyMusVYfhOXc
FLUO_AGENT_ID_ASSESS=agent-UmeIQIjx2QahQJfcT0
```

### Installation
```bash
npm install
npm run dev
```

## Built With
- [Next.js](https://nextjs.org/) - React Framework
- [Fluo](https://fluo.one) - AI Agentic Platform
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI Components
