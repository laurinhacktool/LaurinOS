import fetch from "node-fetch";

const key = "a2ef2472-8ec9-4062-9530-c75f89dc9435";
const endpoints = [
    { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.1-8b-instant" },
    { name: "Mistral", url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest" },
    { name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", model: "openrouter/auto" },
    { name: "SambaNova", url: "https://api.sambanova.ai/v1/chat/completions", model: "Meta-Llama-3.1-8B-Instruct" },
    { name: "DeepInfra", url: "https://api.deepinfra.com/v1/openai/chat/completions", model: "meta-llama/Meta-Llama-3-8B-Instruct" },
    { name: "Together", url: "https://api.together.xyz/v1/chat/completions", model: "meta-llama/Llama-3-8b-chat-hf" },
    { name: "Perplexity", url: "https://api.perplexity.ai/chat/completions", model: "llama-3-sonar-small-32k-online" }
];

async function run() {
    for (const ep of endpoints) {
        try {
            const res = await fetch(ep.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${key}`,
                    "HTTP-Referer": "http://localhost",
                    "X-Title": "Local"
                },
                body: JSON.stringify({
                    model: ep.model,
                    messages: [{role: "system", content: "test"}, {role: "user", content: "Hello"}]
                })
            });
            console.log(`${ep.name}: ${res.status} -> ${(await res.text()).substring(0, 50)}`);
        } catch (e) {
            console.log(`${ep.name}: ERROR`, e);
        }
    }
}
run();
