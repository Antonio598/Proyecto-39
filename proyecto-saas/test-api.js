const fetch = require("node-fetch") || global.fetch;
require("dotenv").config({ path: ".env.local" });

const testPayload = {
  post: { body: "test caption" },
  profiles: ["q2gFbR"], // Fake/random profile id, or I'll just use dummy to see validation error
  video_url: "https://tempfile.aiquickdraw.com/v/762de2ac4f008f45b32a8a50e8466ecf_1775545580.mp4"
};

async function test() {
  const res = await fetch("https://api.postproxy.dev/api/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.POSTPROXY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(testPayload)
  });
  console.log(res.status);
  console.log(await res.json());
}
test();
