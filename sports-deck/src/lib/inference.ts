import { InferenceClient } from "@huggingface/inference";

/** Shared HF model identifier used across utils. */
export const HF_MODEL = "Qwen/Qwen2.5-Coder-7B-Instruct:nscale";

/** Shared HuggingFace Inference client instance. */
export const client = new InferenceClient(process.env.HF_TOKEN);

export default client;
