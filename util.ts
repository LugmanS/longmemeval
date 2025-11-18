export function getFullImageContextPrompt(entry: Question) {
  return `I will give you several history chats as images between you and a user. Please answer the question based on the relevant chat history.

Current Date: ${entry.question_date}

Question: ${entry.question}

Answer:`;
}

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

export function getEvalPrompt(
  type: string,
  question: string,
  answer: string,
  response: string,
  abstention: boolean = false
) {
  if (abstention)
    return `I will give you an unanswerable question, an explanation, and a response from a model. Please answer yes if the model correctly identifies the question as unanswerable. The model could say that the information is incomplete, or some other information is given but the asked information is not.\n\nQuestion: ${question}\n\nExplanation: ${answer}\n\nModel Response: ${response}\n\nDoes the model correctly identify the question as unanswerable? Answer yes or no only.`;

  if (
    [
      "single-session-user",
      "single-session-assistant",
      "multi-session",
    ].includes(type)
  )
    return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. \n\nQuestion: ${question}\n\nCorrect Answer: ${answer}\n\nModel Response: ${response}\n\nIs the model response correct? Answer yes or no only.`;

  if (type === "temporal-reasoning")
    return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. In addition, do not penalize off-by-one errors for the number of days. If the question asks for the number of days/weeks/months, etc., and the model makes off-by-one errors (e.g., predicting 19 days when the answer is 18), the model's response is still correct. \n\nQuestion: ${question}\n\nCorrect Answer: ${answer}\n\nModel Response: ${response}\n\nIs the model response correct? Answer yes or no only.`;

  if (type === "knowledge-update")
    return `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response contains some previous information along with an updated answer, the response should be considered as correct as long as the updated answer is the required answer.\n\nQuestion: ${question}\n\nCorrect Answer: ${answer}\n\nModel Response: ${response}\n\nIs the model response correct? Answer yes or no only.`;

  if (type === "single-session-preference")
    return `I will give you a question, a rubric for desired personalized response, and a response from a model. Please answer yes if the response satisfies the desired response. Otherwise, answer no. The model does not need to reflect all the points in the rubric. The response is correct as long as it recalls and utilizes the user's personal information correctly.\n\nQuestion: ${question}\n\nRubric: ${answer}\n\nModel Response: ${response}\n\nIs the model response correct? Answer yes or no only.`;

  return null;
}
