const key = "a2ef2472-8ec9-4062-9530-c75f89dc9435";
const testCases = [
    { name: "Together", url: "https://api.together.xyz/v1/chat/completions", model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo" },
    { name: "Perplexity", url: "https://api.perplexity.ai/chat/completions", model: "llama-3-sonar-small-32k-online" },
    { name: "DeepSeek", url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" },
    { name: "DeepInfra", url: "https://api.deepinfra.com/v1/openai/chat/completions", model: "meta-llama/Meta-Llama-3-8B-Instruct" },
    { name: "Fireworks", url: "https://api.fireworks.ai/inference/v1/chat/completions", model: "accounts/fireworks/models/llama-v3-8b-instruct" },
    { name: "SambaNova2", url: "https://api.sambanova.ai/v1/chat/completions", model: "Meta-Llama-3.1-8B-Instruct" },
    { name: "SambaNova3", url: "https://api.sambanova.ai/v1/chat/completions", model: "Meta-Llama-3.1-405B-Instruct" }
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
