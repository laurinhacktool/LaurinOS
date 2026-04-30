import fetch from "node-fetch";

async function testURL(url: string) {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "mistralai/Mistral-7B-Instruct-v0.3",
                messages: [{role: "user", content: "Hi"}]
            })
        });
        console.log("Response from", url, ":", res.status, await res.text());
    } catch(e) { console.log(url, e); }
}

testURL("https://api-inference.huggingface.co/v1/chat/completions");
testURL("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions");
testURL("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3");
