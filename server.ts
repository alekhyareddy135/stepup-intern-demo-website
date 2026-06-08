import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";

// Initialize express app
const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Helper function to lazy-initialize GoogleGenAI
let aiInstance: GoogleGenAI | null = null;
function getAIInstance() {
  if (aiInstance) return aiInstance;
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY" || key.trim() === "") {
    console.warn("GEMINI_API_KEY is not defined. Falling back to structured simulator.");
    return null;
  }
  try {
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    return aiInstance;
  } catch (error) {
    console.error("Error creating GoogleGenAI instance", error);
    return null;
  }
}

// REST API endpoint: Check status of AI Ecosystem
app.get("/api/health", (req, res) => {
  const isAiActive = !!getAIInstance();
  res.json({
    status: "ok",
    aiConfigured: isAiActive,
    timestamp: new Date().toISOString(),
  });
});

// REST API endpoint: AI Career Coach Chat / Roadmap Generator
app.post("/api/ai/coach", async (req, res) => {
  const { prompt, history, careerGoal } = req.body;
  const ai = getAIInstance();

  if (!ai) {
    // Elegant system simulator fallback
    const simulatedResponse = getSimulatedCoachResponse(prompt, careerGoal);
    return res.json({ text: simulatedResponse });
  }

  try {
    // Prepare prompt with role-specific context
    const introContext = `You are "StepUp Elite AI Career Coach", an empathetic, inspiring, and sharp tech & business recruitment veteran.
The student has selected a current career goal: ${careerGoal || "General Career Discovery"}.
Provide advice which is actionable, clear, structured as markdown, and directly addresses the student's prompt: "${prompt}". Suggest specific skills, projects, and interview tips. Keep it concise, professional, and visually attractive (using bullet points and bold highlights).`;

    const chatHistoryParts = (history || []).map((h: any) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    }));

    // Add current context
    chatHistoryParts.push({
      role: "user",
      parts: [{ text: introContext }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: chatHistoryParts,
    });

    res.json({ text: response.text || "No response received from the Gemini coach." });
  } catch (error: any) {
    console.error("Gemini Coach Error:", error);
    res.status(500).json({ error: error.message || "Failure contacting Gemini Career Coach" });
  }
});

// REST API endpoint: AI Resume Analyzer & Keywords scoring (ATS compatible)
app.post("/api/ai/resume-check", async (req, res) => {
  const { resumeText, targetRole } = req.body;
  const ai = getAIInstance();

  if (!ai) {
    // Robust system parser fallback
    const simulatedAnalysis = getSimulatedResumeAnalysis(resumeText, targetRole);
    return res.json(simulatedAnalysis);
  }

  try {
    const prompt = `You are a professional corporate Applicant Tracking System (ATS) and an elite tech recruiter.
Analyze the following resume details for the target role: "${targetRole || "Software Engineer Intern"}".

Resume draft content:
"${resumeText}"

Evaluate the resume and return a JSON payload with exact keys:
{
  "score": <number 0-100>,
  "grammarScore": <number 0-100>,
  "keywordScore": <number 0-100>,
  "formattingScore": <number 0-100>,
  "impactScore": <number 0-100>,
  "matchingKeywords": [<string>],
  "missingKeywords": [<string>],
  "grammarIssues": [<string>],
  "feedback": [<string>],
  "formattedSuggestions": <string in markdown layout listing 3 immediate action items>
}
Your output must be strict valid JSON only. Output absolutely nothing outside of this JSON block.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini Resume Checker Error:", error);
    res.status(500).json({ error: error.message || "Fail to check resume with Gemini" });
  }
});

// REST API endpoint: AI Mock Interview Session
app.post("/api/ai/interview-prep", async (req, res) => {
  const { role, userReply, chatHistory } = req.body;
  const ai = getAIInstance();

  if (!ai) {
    // Realistic interview companion fallback
    const simulatedQuestion = getSimulatedInterviewSession(role, userReply, chatHistory);
    return res.json(simulatedQuestion);
  }

  try {
    const prompt = `You are "StepUp Elite AI Recruiter", conducting an interactive mock interview for the role of ${role || "Full-Stack Developer Intern"}.
The user is responding to your questions.

Current User Reply: "${userReply || "I am exciting to start and learn everything about this role!"}"

Respond with a JSON object. Assess their reply and ask the next strategic question.
Your response MUST strictly match this JSON schema:
{
  "feedbackOnLastReply": "<Brief evaluation of user's answer, citing strengths and gaps, max 3 sentences>",
  "nextQuestion": "<The next realistic behavioral or technical interview question for this role>",
  "overallSessionGrade": "<Excellent | Good | Average | Needs Work>"
}
Ensure strict JSON format is met. Return nothing else.`;

    const chatHistoryParts = (chatHistory || []).map((h: any) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    }));

    chatHistoryParts.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: chatHistoryParts,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini Mock Interview Error:", error);
    res.status(500).json({ error: error.message || "Failed interview prep API call" });
  }
});

// REST API endpoint: AI Recruiter: Match Candidate resumes against Job Requirements
app.post("/api/ai/candidate-ranking", async (req, res) => {
  const { jobTitle, requirements, candidates } = req.body;
  const ai = getAIInstance();

  if (!ai) {
    const mockRankings = getSimulatedCandidatesRanking(jobTitle, requirements, candidates);
    return res.json({ rankings: mockRankings });
  }

  try {
    const prompt = `You are an elite artificial recruitment ranking module analyzing applicants for the job: "${jobTitle}".
Key Requirements: "${requirements}"

Candidate information list:
${JSON.stringify(candidates)}

Evaluate each candidate's profile against the role requirements.
Return a structured JSON list of rankings. The response MUST be a JSON object with a "rankings" key, containing an array of candidate matches:
{
  "rankings": [
    {
      "id": <candidate id>,
      "name": "<candidate name>",
      "matchPercentage": <number between 0 and 100>,
      "reasoning": "<1 sentence justifying the calculated compatibility score>"
    }
  ]
}
Return only this strict JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsedData = JSON.parse(response.text || '{"rankings": []}');
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini Candidate Ranking Error:", error);
    res.status(500).json({ error: error.message || "Exception ranking profiles with Gemini" });
  }
});


// ==========================================
// MOCK SIMULATOR FALLBACK FUNCTIONS
// ==========================================

function getSimulatedCoachResponse(prompt: string, goal?: string): string {
  const target = goal || "Software Engineering";
  let content = `### StepUp Elite Career Advice Tracker (Simulated Mode)

Since your Career Goal is **${target}**, here is a targeted guide addressing your query: *"${prompt}"*.

1. **Strategic Missing Skills**:
   - Focus on modern state management, micro-frontends, high-performance API design.
   - Master system design architecture (system boundaries, data modeling, caching, pub-sub clusters).

2. **Actionable Roadmap**:
   - **Week 1**: Design mockups. Establish data models. Prepare automated testing.
   - **Week 2**: Integrate services, configure environment pipelines.
   - **Week 3**: Optimize queries, build custom visual dashboards, run performance benchmarks.

3. **Top Recommended Courses for ${target}**:
   - *Advanced System Design & Scalability* (Coursera / Elite Academy)
   - *Full-Stack React & Node Production Guide* (Frontend Masters)
   - *Cloud Native & Kubernetes Deployments* (Google Cloud Training)

4. **Interactive Action Task**:
   - Write a self-contained local Express proxy server in Node.js and test endpoint response times.`;
  return content;
}

function getSimulatedResumeAnalysis(resumeText: string = "", targetRole: string = "Frontend Engineer Intern") {
  const words = resumeText.toLowerCase();
  
  // Calculate adaptive ratings based on simple keyword scans
  const hasReact = words.includes("react");
  const hasSql = words.includes("sql") || words.includes("database");
  const hasGit = words.includes("git") || words.includes("github");
  const lengthScore = Math.min(100, Math.max(40, resumeText.trim().length / 6));

  const keywordScore = hasReact && hasGit ? 85 : 55;
  const formattingScore = words.includes("experience") && words.includes("education") ? 90 : 65;
  const grammarScore = 95; // default high index
  const impactScore = words.includes("achieved") || words.includes("led") || words.includes("improved") ? 88 : 50;

  const totalScore = Math.round((keywordScore + formattingScore + grammarScore + impactScore) / 4);

  const missingKeywords = [];
  if (!words.includes("docker")) missingKeywords.push("Docker/Kubernetes");
  if (!words.includes("ci/cd") && !words.includes("pipeline")) missingKeywords.push("CI/CD Pipelines");
  if (!words.includes("typescript")) missingKeywords.push("TypeScript");
  if (!words.includes("aws") && !words.includes("cloud")) missingKeywords.push("Cloud Infrastructure (GCP/AWS)");

  const matchingKeywords = [];
  if (hasReact) matchingKeywords.push("React.js");
  if (hasSql) matchingKeywords.push("Relational Databases");
  if (hasGit) matchingKeywords.push("Version Control (Git)");
  if (words.includes("css") || words.includes("style")) matchingKeywords.push("Tailwind CSS");

  return {
    score: totalScore,
    grammarScore,
    keywordScore,
    formattingScore,
    impactScore,
    matchingKeywords,
    missingKeywords,
    grammarIssues: ["Consider replacing passive phrases such as 'responsible for maintaining' with powerful action verbs such as 'Redesigned and Optimized'."],
    feedback: [
      "Excellent technical summary but the experience section would benefit from more metrics.",
      "The ATS tool suggests adding more industry keywords tied directly to cloud infrastructure workflows.",
      "ATS formatting detected as standard single-column, which parses cleanly across major global HR platforms!"
    ],
    formattedSuggestions: `### Immediate Resume Action Plan

1. **Add Metrics and Indicators**: Replace generic bullet points with quantified wins. E.g., *"Optimized state-management pipelines, **cutting page load times by 24%** and improving accessibility compliance."*
2. **Inject Missing ATS Keywords**: Integrate keywords such as **TypeScript**, **Docker/Kubernetes**, and **CI/CD Pipelines** organically into your projects directory.
3. **Draft a Strong Profile Summary**: Open with a 2-line visual professional bio stating target role and core certifications.`
  };
}

function getSimulatedInterviewSession(role: string = "Software Intern", reply: string = "", history: any[] = []) {
  const index = Math.max(0, history.filter(h => h.role === "model").length);
  const questionsList = [
    "Tell me about a time you solved a complex development issue or bug, and how you tracked down the root cause.",
    "Excellent! How do you handle stressful client or team deadlines when requirements change at the eleventh hour?",
    "Perfect. In your own projects, how do you approach database schema design and scalability? What are your strategies for high traffic optimization?",
    "Understood. If you had to explain the difference between REST architecture and WebSockets to a high-school student, how would you put it?",
    "That is highly descriptive. What is your preferred development cycle workflow or methodology, and how do you ensure code coverage?"
  ];

  const nextQuestion = questionsList[index % questionsList.length];
  
  return {
    feedbackOnLastReply: reply.trim().length > 0 
      ? `You demonstrated proactive thinking. You appropriately focused on communication, though you could mention more technical constraints or key metrics to cement your experience.` 
      : "Let's begin the technical screening! I will ask a few core industry questions.",
    nextQuestion,
    overallSessionGrade: index >= 3 ? "Excellent" : "Average"
  };
}

function getSimulatedCandidatesRanking(jobTitle: string, requirements: string, candidates: any[]) {
  return candidates.map((cand, idx) => {
    // Generate simulated score based on index
    const baseScore = 95 - (idx * 8);
    const score = Math.max(50, Math.min(99, baseScore));
    return {
      id: cand.id,
      name: cand.name,
      matchPercentage: score,
      reasoning: `Strong balance of relevant skills in projects aligned with "${jobTitle}". Lacks some minor advanced requirements.`
    };
  });
}


// ==========================================
// MIDDLEWARES FOR DEVELOPMENT VS PRODUCTION
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`StepUp Elite full stack Node server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
