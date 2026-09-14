export async function onRequestPost({ request, env }) {
  const cors = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  const json = (body, status=200) => new Response(JSON.stringify(body), { status, headers: cors });
  if (!env.GROQ_API_KEY) return json({ error: "Chat service is not configured." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12) {
    return json({ error: "Send between 1 and 12 messages." }, 400);
  }
  const messages = [];
  for (const m of body.messages) {
    if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 2000) {
      return json({ error: "A message is invalid or too long." }, 400);
    }
    messages.push({ role: m.role, content: m.content.trim() });
  }
  if (messages[messages.length - 1].role !== "user") return json({ error: "Your latest message must be a question." }, 400);
  const system = {
    role: "system",
    content: "You are pieAI, a friendly academic doubt helper for PIE Classes students, primarily school learners in India. Help with school subjects using clear, age-appropriate language and step-by-step explanations. Ask a brief clarifying question when needed. For maths and science, show working and units. Do not claim certainty when unsure; say so and encourage checking the textbook or teacher. Stay focused on academics. Never request personal information, passwords, or API keys."
  };
  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [system, ...messages], temperature: 0.4, max_tokens: 900 })
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return json({ error: "The AI provider returned an error. Try again later." }, 502);
    const reply = result?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) return json({ error: "No answer was returned." }, 502);
    return json({ reply: reply.trim() });
  } catch {
    return json({ error: "Could not reach the AI provider." }, 502);
  }
}
