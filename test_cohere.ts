import fetch from "node-fetch";
const key = "a2ef2472-8ec9-4062-9530-c75f89dc9435";
async function run() {
    const res = await fetch("https://api.cohere.ai/v1/chat", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello", model: "command" })
    });
    console.log("Cohere:", res.status, await res.text());
}
run();
