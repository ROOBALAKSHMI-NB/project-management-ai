import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = 'llama-3.3-70b-versatile';

export async function chat(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
  });
  return response.choices[0]?.message?.content || '';
}

export async function analyzeProject(projectData: {
  name: string;
  tasks: Array<{ title: string; status: string; priority: string; assignee?: string; due_date?: string }>;
  members: string[];
}) {
  const prompt = `You are a project management AI assistant. Analyze this project and provide insights.

Project: ${projectData.name}
Team Members: ${projectData.members.join(', ')}
Tasks (${projectData.tasks.length} total):
${projectData.tasks.map(t => `- [${t.status}][${t.priority}] ${t.title}${t.assignee ? ` (assigned to ${t.assignee})` : ''}${t.due_date ? ` (due: ${t.due_date})` : ''}`).join('\n')}

Please provide:
1. Risk Analysis - identify bottlenecks and risks
2. Timeline Assessment - is the project on track?
3. Workload Balance - are tasks distributed fairly?
4. Top 3 Recommendations

Respond in JSON format:
{
  "riskLevel": "low|medium|high",
  "risks": ["risk1", "risk2"],
  "timelineStatus": "on_track|at_risk|delayed",
  "workloadIssues": ["issue1"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "summary": "Brief overall summary"
}`;

  const response = await chat([{ role: 'user', content: prompt }]);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return { summary: response, recommendations: [], risks: [], riskLevel: 'medium', timelineStatus: 'on_track', workloadIssues: [] };
}

export async function suggestTasks(projectData: {
  name: string;
  description: string;
  existingTasks: string[];
}) {
  const prompt = `You are a project management AI. Suggest next logical tasks for this project.

Project: ${projectData.name}
Description: ${projectData.description}
Existing Tasks: ${projectData.existingTasks.join(', ') || 'None yet'}

Suggest 5 specific, actionable tasks. Respond in JSON:
{
  "suggestions": [
    {
      "title": "Task title",
      "description": "What needs to be done",
      "priority": "low|medium|high|critical",
      "estimatedHours": 4
    }
  ]
}`;

  const response = await chat([{ role: 'user', content: prompt }]);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return { suggestions: [] };
}

export async function breakdownTask(taskTitle: string, projectContext: string) {
  const prompt = `You are a project management AI. Break down this high-level task into subtasks.

Task: ${taskTitle}
Project Context: ${projectContext}

Create 4-8 specific subtasks. Respond in JSON:
{
  "subtasks": [
    {
      "title": "Subtask title",
      "description": "Details",
      "priority": "low|medium|high",
      "estimatedHours": 2
    }
  ]
}`;

  const response = await chat([{ role: 'user', content: prompt }]);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return { subtasks: [] };
}

export async function parseNaturalLanguageTask(text: string, projectMembers: string[]) {
  const prompt = `Parse this natural language task creation request into structured data.

Request: "${text}"
Available team members: ${projectMembers.join(', ')}

Extract task information. Respond ONLY in JSON:
{
  "title": "Task title",
  "description": "Task description if mentioned",
  "priority": "low|medium|high|critical",
  "assignee": "member name if mentioned or null",
  "dueDate": "ISO date string if mentioned or null",
  "estimatedHours": number if mentioned or null
}`;

  const response = await chat([{ role: 'user', content: prompt }]);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return { title: text, priority: 'medium', assignee: null, dueDate: null, estimatedHours: null };
}
