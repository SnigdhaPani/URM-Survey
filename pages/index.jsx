import { useState, useEffect, useRef } from "react";
export default function SurveyApp() {
const CONDITIONS = ["celebrity", "creativity", "brand", "price", "story", "control"];

const VIDEOS = {
celebrity: ["/videos/celebrity1.mp4"],
creativity: ["/videos/creativity1.mp4"],
brand: ["/videos/brand1.mp4"],
price: ["/videos/price1.mp4"],
story: ["/videos/story1.mp4"],
control: ["/videos/control1.mp4"],
};

const [stage, setStage] = useState("welcome");
const [condition, setCondition] = useState(null);
const [videoUrl, setVideoUrl] = useState(null);
const [startTime, setStartTime] = useState(null);
const [watchDuration, setWatchDuration] = useState(null);
const [participantId] = useState(() => "p_" + Math.random().toString(36).slice(2, 9));

const [responses, setResponses] = useState({ purchase_intent: null, attention: null });

const videoRef = useRef(null);

function assignCondition() {
const cond = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
setCondition(cond);
const chosenVideo = VIDEOS[cond][0];
setVideoUrl(chosenVideo);
setStage("video");
}

function endVideo() {
setWatchDuration(Math.round((Date.now() - startTime) / 1000));
setStage("questions");
}

async function submitData() {
const payload = {
participantId,
condition,
videoUrl,
startTime,
watchDuration,
responses,
};

await fetch("/api/submit", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

setStage("thankyou");
}

return (
<div style={{ padding: 40, fontFamily: "sans-serif" }}>
{stage === "welcome" && (
<div>
<h1>Welcome to the Ad Survey</h1>
<button onClick={assignCondition}>Start</button>
</div>
)}

{stage === "video" && (
<div>
<h2>Watch the Video</h2>
<video
ref={videoRef}
src={videoUrl}
width="600"
controls
autoPlay
onPlay={() => setStartTime(Date.now())}
onEnded={endVideo}
/>
</div>
)}

{stage === "questions" && (
<div>
<h2>Questions</h2>

<p>How likely are you to purchase this product? (1–7)</p>
{[1, 2, 3, 4, 5, 6, 7].map((n) => (
<button
key={n}
onClick={() => setResponses({ ...responses, purchase_intent: n })}
style={{ margin: 4 }}
>
{n}
</button>
))}

<p>Attention check: select number 3</p>
{[1, 2, 3, 4, 5, 6, 7].map((n) => (
<button
key={n}
onClick={() => setResponses({ ...responses, attention: n })}
style={{ margin: 4 }}
>
{n}
</button>
))}

<br />
<button onClick={submitData}>Submit</button>
</div>
)}

{stage === "thankyou" && <h2>Thank you! Your response is recorded.</h2>}
</div>
);
}