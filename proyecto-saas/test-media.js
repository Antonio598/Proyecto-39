const fetch = require("node-fetch") || global.fetch;

const testPayload1 = {
  post: { body: "test caption" },
  media_urls: ["https://tempfile.aiquickdraw.com/v/762de2ac4f008f45b32a8a50e8466ecf_1775545580.mp4"],
  profiles: ["q2gFbR"]
};

// or inside post?
const testPayload2 = {
  post: { body: "test caption", media_urls: ["https://tempfile.aiquickdraw.com/v/762de2ac4f008f45b32a8a50e8466ecf_1775545580.mp4"] },
  profiles: ["q2gFbR"]
};

const testPayload3 = {
  post: { body: "test caption", media: ["https://tempfile.aiquickdraw.com/v/762de2ac4f008f45b32a8a50e8466ecf_1775545580.mp4"] },
  profiles: ["q2gFbR"]
};

const testPayload4 = {
  post: { body: "test caption" },
  media: ["https://tempfile.aiquickdraw.com/v/762de2ac4f008f45b32a8a50e8466ecf_1775545580.mp4"],
  profiles: ["q2gFbR"]
};

async function test(payload) {
  const res = await fetch("https://api.postproxy.dev/api/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
      // not sending auth so that we just trigger validation error to see which format is closest
    },
    body: JSON.stringify(payload)
  });
  console.log(res.status, await res.json());
}
async function run() {
  await test(testPayload1);
  await test(testPayload2);
  await test(testPayload3);
  await test(testPayload4);
}
run();
