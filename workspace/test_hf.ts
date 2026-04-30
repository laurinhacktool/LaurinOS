import fetch from "node-fetch";
async function test() {
    const res = await fetch("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "mistralai/Mistral-7B-Instruct-v0.3",
            messages: [{role: "user", content: "Hi"}]
        })
    });
    console.log(res.status, await res.text());
}
test();
