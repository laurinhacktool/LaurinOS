import fetch from "node-fetch";
const key = "a2ef2472-8ec9-4062-9530-c75f89dc9435";
async function testURL(url: string, model: string) {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "My App"
        },
        body: JSON.stringify({
            model: model,
            messages: [{role: "user", content: "Hi"}]
        })
    });
    console.log(url, res.status, await res.text());
}
testURL("https://openrouter.ai/api/v1/chat/completions", "openrouter/auto");
