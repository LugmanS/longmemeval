export function getFullContextPrompt(entry: Question) {
  return `I will give you several history chats between you and a user. Please answer the question based on the relevant chat history.

History Chats:

${entry.haystack_sessions
  .map(
    (s, i) => `### Session ${i + 1}

Session Date: ${entry.haystack_dates[i]}

Session Content:

${s
  .map((m) => JSON.stringify({ role: m.role, content: m.content }))
  .join("\n\n")}`
  )
  .join("\n\n\n")}

Current Date: ${entry.question_date}

Question: ${entry.question}

Answer:`;
}
