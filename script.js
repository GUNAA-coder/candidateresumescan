/* Explainable Candidate-Role Fit Engine
   Client-side matching engine: no backend, no API keys.
   Data is passed between the three pages via localStorage. */

const STORE_KEY = "cfe_session_v1";

function splitList(text) {
  return (text || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function norm(s) {
  return s.toLowerCase().trim();
}

/* ---------- Scoring ---------- */
function scoreCandidate(data) {
  const required = splitList(data.requiredSkills);
  const candidateSkills = splitList(data.candidateSkills);
  const reqNorm = required.map(norm);
  const candNorm = candidateSkills.map(norm);

  const matched = required.filter(r => candNorm.includes(norm(r)));
  const missing = required.filter(r => !candNorm.includes(norm(r)));
  const extra = candidateSkills.filter(c => !reqNorm.includes(norm(c)));

  const skillPct = required.length
    ? Math.round((matched.length / required.length) * 100)
    : 100;

  const reqExp = parseFloat(data.requiredExp) || 0;
  const candExp = parseFloat(data.candidateExp) || 0;
  const expPct = reqExp > 0 ? Math.min(100, Math.round((candExp / reqExp) * 100)) : 100;

  const finalPct = Math.round(skillPct * 0.75 + expPct * 0.25);
  const selected = finalPct >= 70;

  return { matched, missing, extra, skillPct, expPct, finalPct, selected, required, reqExp, candExp };
}

/* ---------- Feedback for a declined candidate ---------- */
function buildFeedback(result, data) {
  const lines = [];

  if (result.missing.length) {
    lines.push(
      `The role called for ${result.required.length} core skill${result.required.length === 1 ? "" : "s"}; your profile matched ${result.matched.length} of them. The gap is in: ${result.missing.join(", ")}.`
    );
  } else {
    lines.push("Your listed skills covered every skill the role asked for.");
  }

  if (result.reqExp > 0 && result.candExp < result.reqExp) {
    lines.push(
      `The role asked for ${result.reqExp} year${result.reqExp === 1 ? "" : "s"} of experience; ${result.candExp || 0} year${result.candExp === 1 ? "" : "s"} was on file, which pulled the overall score down.`
    );
  }

  if (result.extra.length) {
    lines.push(
      `Skills like ${result.extra.slice(0, 4).join(", ")} weren't required for this role, but keep them listed — they may fit other openings.`
    );
  }

  lines.push(
    `Closing the skill gap above and reapplying, or applying to a role that weights ${result.matched[0] || "your current strengths"} more heavily, are the two most direct next steps.`
  );

  return lines;
}

/* ---------- Interview question bank ---------- */
const QUESTION_BANK = {
  javascript: ["Walk through how closures work and where you've relied on one.", "How would you debug a memory leak in a long-running JS app?"],
  python: ["How do you decide between a list, tuple, and generator for a given task?", "Describe how you'd structure a Python project that's outgrown a single script."],
  java: ["Explain the difference between an abstract class and an interface, with a case where you chose one over the other.", "How have you handled memory management or garbage-collection tuning in a Java service?"],
  sql: ["Write or describe a query that finds duplicate rows in a table — how would you then remove them safely?", "How do you decide when to add an index, and what's the tradeoff?"],
  react: ["When would you reach for context versus prop drilling versus a state library?", "Describe a time a component re-rendered more than expected — how did you find and fix it?"],
  "machine learning": ["How do you detect and handle overfitting in a model you've built?", "Walk through how you'd evaluate a classifier beyond raw accuracy."],
  "data analysis": ["Describe a dataset you cleaned that was messier than expected — what did you do?", "How do you decide which chart or summary best answers a stakeholder's question?"],
  communication: ["Tell me about a time you had to explain a technical decision to a non-technical stakeholder.", "Describe a disagreement with a teammate and how you resolved it."],
  leadership: ["Describe a time you had to motivate a team through a tight deadline.", "Tell me about a decision you made that you later had to reverse — what did you do?"],
  "project management": ["How do you handle a project that's slipping behind schedule?", "Walk through how you prioritize a backlog when everything is marked urgent."],
  "problem solving": ["Describe the hardest bug or issue you've had to track down.", "Tell me about a time you had incomplete information and still had to make a call."],
  "cloud computing": ["How would you design a system to stay available during a regional outage?", "Walk through a cost-vs-reliability tradeoff you've made on a cloud deployment."],
  aws: ["Which AWS services would you reach for to stand up a simple, reliable web API, and why?", "Describe a time an AWS service didn't behave as expected — how did you diagnose it?"],
  docker: ["Walk through how you'd containerize an app that currently only runs on your machine.", "How do you keep a Docker image small and secure?"],
  git: ["Describe your branching strategy on a team project.", "Walk through how you'd resolve a tricky merge conflict."],
  communication_default: ["Tell me about a project you're proud of and the role you played in it.", "Describe a time you received critical feedback — what did you do with it?"]
};

const GENERIC_QUESTIONS = [
  "Walk me through a project on your resume that best represents how you work.",
  "Tell me about a time a plan of yours didn't work out — what did you learn?",
  "How do you approach learning a skill or tool you don't already know?",
  "Describe how you prioritize when you have more tasks than time.",
  "What kind of feedback has changed how you work?"
];

function buildQuestions(data) {
  const required = splitList(data.requiredSkills).map(s => norm(s));
  const missing = splitList(data.missingSkills || "").map(s => norm(s));
  const groups = [];

  required.forEach(skill => {
    const key = Object.keys(QUESTION_BANK).find(k => skill.includes(k) || k.includes(skill));
    if (key) {
      groups.push({
        tag: missing.includes(skill) ? `${skill} — probe the gap` : skill,
        questions: QUESTION_BANK[key]
      });
    }
  });

  if (!groups.length) {
    groups.push({ tag: "general fit", questions: GENERIC_QUESTIONS });
  } else {
    groups.push({ tag: "closing", questions: [GENERIC_QUESTIONS[0], GENERIC_QUESTIONS[1]] });
  }
  return groups;
}

/* ---------- Session storage helpers ---------- */
function saveSession(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch (e) { return null; }
  }
