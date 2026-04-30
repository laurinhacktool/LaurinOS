const key = "a2ef2472-8ec9-4062-9530-c75f89dc9435";
async function test() {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "openrouter/auto",
            messages: [{role: "user", content: "Hi"}]
        })
    });
    console.log(res.status, await res.text());
}
test();
