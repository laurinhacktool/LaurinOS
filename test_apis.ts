const key = "a2ef2472-8ec9-4062-9530-c75f89dc9435";
const testCases = [
    { name: "SambaNova", url: "https://api.sambanova.ai/v1/chat/completions", model: "Meta-Llama-3.1-70B-Instruct" },
    { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.1-8b-instant" },
    { name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", model: "openrouter/auto" },
    { name: "Mistral", url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest" },
    { name: "HuggingFace", url: "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions", model: "mistralai/Mistral-7B-Instruct-v0.3" }
];

async function test() {
    for (const test of testCases) {
        console.log(`Testing ${test.name}...`);
        try {
            const res = await fetch(test.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: test.model,
                    messages: [{ role: "user", content: "Hi" }]
                })
            });
            const text = await res.text();
            console.log(`Result ${test.name}: ${res.status} ${text.substring(0, 100)}`);
        } catch (e) {
            console.log(`Failed ${test.name}: ${e}`);
        }
    }
}
test();
