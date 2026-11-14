// The only place that talks to the LLM provider.

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function complete(messages: ModelMessage[]): Promise<string> {
  // TODO: call the provider using process.env.LLM_API_KEY and process.env.LLM_MODEL
  void messages;
  throw new Error("complete() is not implemented");
}

export async function* stream(messages: ModelMessage[]): AsyncGenerator<string> {
  // TODO: streaming call
  void messages;
  throw new Error("stream() is not implemented");
}

// Calls the model and parses JSON; retries once on invalid output.
export async function completeJson<T>(
  messages: ModelMessage[],
  validate: (value: unknown) => T,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return validate(JSON.parse(await complete(messages)));
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Model returned invalid JSON twice: ${String(lastError)}`);
}
