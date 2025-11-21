// pages/index.jsx
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

/*
  EXCEL_URL points to the Excel file you uploaded in this environment.
  Per your session, that path is:
*/
const EXCEL_URL = "/mnt/data/Urm survey questions.xlsx";

const VIDEO_MAP = {
  CE: {
    code: "CE",
    name: "Celebrity Endorsement",
    yt: "https://www.youtube.com/watch?v=CsCqkkjF-8E",
    moreInfo: "https://www.sansaar.co.in/products",
  },
  AC: {
    code: "AC",
    name: "Ad Creativity",
    yt: "http://youtube.com/shorts/cixvzLa0d1c",
    moreInfo:
      "https://www.amazon.in/stores/BIC-Cello/page/A84B777B-6C4A-43D2-9A96-0C8FF334DA33",
  },
  PP: {
    code: "PP",
    name: "Price Perception",
    yt: "https://www.youtube.com/watch?v=1ihGeitBI_4&t=42s",
    moreInfo:
      "https://www.mi.com/in/product-list/tv/?srsltid=AfmBOoqXmnHU1VFFP7Jb4GlY_eZBIpR7m_fKcfu7A2cSsXdMo20mUkm5",
  },
  BT: {
    code: "BT",
    name: "Brand Trust",
    yt: "https://www.youtube.com/watch?v=LcGPI2tV2yY",
    moreInfo: "https://www.apple.com/in/",
  },
  ST: {
    code: "ST",
    name: "Storytelling",
    yt: "https://www.youtube.com/watch?v=JDk3GQkTyN4&list=PLXLT0cAAZyduzk5U5a43xdgrZY6fBCjMN&index=37",
    moreInfo: "https://havells.com/home-electricals/flexible-cables.html",
  },
};

const LIKERT = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
];

function extractYouTubeID(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.has("v")) return u.searchParams.get("v");
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  } catch {
    const m = url.match(/v=([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
}

export default function SurveyPage() {
  const [stage, setStage] = useState("consent"); // consent -> demographics -> video -> questions -> complete / exit
  const [consent, setConsent] = useState(null);

  const [ageGroup, setAgeGroup] = useState(null);
  const [ageRaw, setAgeRaw] = useState("");
  const [gender, setGender] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [perAdFinalQuestion, setPerAdFinalQuestion] = useState({});

  const [assignedAdCode, setAssignedAdCode] = useState(null);
  const [assignedAd, setAssignedAd] = useState(null);

  const ytPlayerRef = useRef(null);

  const [videoStartedAt, setVideoStartedAt] = useState(null);
  const [videoEndedAt, setVideoEndedAt] = useState(null);
  const [watchSeconds, setWatchSeconds] = useState(null);

  const [answers, setAnswers] = useState({});
  const [clickedMoreInfo, setClickedMoreInfo] = useState(false);

  const [participantId] = useState(
    "p_" + Math.random().toString(36).substring(2, 9)
  );
  const [completionCode, setCompletionCode] = useState(null);

  // Load Excel and parse questions + per-ad final questions
  useEffect(() => {
    async function loadExcel() {
      try {
        const res = await fetch(EXCEL_URL);
        if (!res.ok) throw new Error("Excel not found");
        const arrayBuffer = await res.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const genQs = [];
        const adFinal = {};
        for (let r of rows) {
          const qText = r && r[0] ? String(r[0]).trim() : null;
          const b = r && r[1] ? String(r[1]).trim() : null;
          if (!qText) continue;
          if (b && ["CE", "AC", "PP", "BT", "ST"].includes(b)) {
            adFinal[b] = qText;
          } else {
            genQs.push(qText);
          }
        }
        setQuestions(genQs);
        setPerAdFinalQuestion(adFinal);
      } catch (err) {
        console.error("Failed to load Excel:", err);
        setQuestions([
          "The ad made the product look appealing.",
          "The ad was memorable.",
          "The ad improved my impression of the brand.",
        ]);
        setPerAdFinalQuestion({
          CE: "I would search for more information about the celebrity-endorsed product after watching this advertisement.",
          AC: "I would search for more information about the product after watching this creative advertisement.",
          PP: "I would search for more information about the product after watching this price-focused advertisement.",
          BT: "I would search for more information about the product after watching this brand-focused advertisement.",
          ST: "I would search for more information about the product after watching this storytelling advertisement.",
        });
      }
    }
    loadExcel();
  }, []);

  // Age gating: if under 18 or over 35 exit
  function handleConsentContinue() {
    if (!consent) {
      alert("You must agree to participate to continue.");
      return;
    }
    const parsed = ageRaw ? parseInt(ageRaw, 10) : null;
    if (parsed && (parsed < 18 || parsed > 35)) {
      setStage("age-exit");
      return;
    }
    // If they will select age group on next page, proceed
    setStage("demographics-confirm");
  }

  // Randomly assign ad and init YT player
  function assignRandomAdAndPlay() {
    const keys = Object.keys(VIDEO_MAP);
    const chosenCode = keys[Math.floor(Math.random() * keys.length)];
    const ad = VIDEO_MAP[chosenCode];
    setAssignedAdCode(chosenCode);
    setAssignedAd(ad);
    setStage("video");
    setTimeout(() => initYouTubePlayer(ad.yt), 300);
  }

  // Init YouTube IFrame API and watch for end
  async function initYouTubePlayer(ytUrl) {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      await new Promise((res) => {
        const t = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(t);
            res();
          }
        }, 100);
      });
    }

    try {
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
    } catch {}

    const vid = extractYouTubeID(ytUrl);
    if (!vid) {
      console.error("Cannot parse YouTube ID for", ytUrl);
      return;
    }

    ytPlayerRef.current = new window.YT.Player("yt-player", {
      height: "360",
      width: "640",
      videoId: vid,
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onReady: (ev) => {
          try {
            ev.target.playVideo();
            setVideoStartedAt(new Date().toISOString());
          } catch {}
        },
        onStateChange: (e) => {
          if (e.data === 0) {
            const end = new Date().toISOString();
            setVideoEndedAt(end);
            let secs = null;
            try {
              secs = Math.round(ytPlayerRef.current.getCurrentTime());
            } catch {}
            setWatchSeconds(secs);
            setStage("questions");
          }
        },
      },
    });
  }

  function handleMoreInfoClick() {
    setClickedMoreInfo(true);
    if (assignedAd && assignedAd.moreInfo) {
      window.open(assignedAd.moreInfo, "_blank", "noopener");
    }
  }

  function setAnswerFor(index, numeric) {
    setAnswers((p) => ({ ...p, [index]: numeric }));
  }

  function setLastQuestionAnswer(numeric) {
    setAnswers((p) => ({ ...p, last: numeric }));
  }

  async function handleSubmit() {
    const responsesObj = {};
    questions.forEach((q, idx) => {
      const v = answers[idx] ?? null;
      responsesObj[q] = v !== null ? { numeric: v, text: LIKERT[v - 1] } : { numeric: null, text: null };
    });

    const finalQText = perAdFinalQuestion[assignedAdCode] || "I would search for more information about the product after watching this advertisement.";
    const lastVal = answers.last ?? null;
    responsesObj[finalQText] = lastVal !== null ? { numeric: lastVal, text: LIKERT[lastVal - 1] } : { numeric: null, text: null };

    const payload = {
      participantId,
      consent,
      ageGroup,
      ageRaw,
      gender,
      assignedAdCode,
      assignedAdURL: assignedAd ? assignedAd.yt : null,
      startTime: videoStartedAt,
      endTime: videoEndedAt,
      watchSeconds,
      clickedMoreInfo,
      moreInfoURL: assignedAd ? assignedAd.moreInfo : null,
      responses: responsesObj,
      timestamp: new Date().toISOString(),
    };

    try {
      const r = await fetch("/api/submit", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "submit failed");
      setCompletionCode(data.completionCode || null);
      setStage("complete");
    } catch (err) {
      console.error(err);
      alert("Submission failed. Please try again.");
    }
  }

  // Render stages
  if (stage === "age-exit") {
    return (
      <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
        <h2>Thank you</h2>
        <p>You indicated that you are outside the eligible age range for this study. Thank you for your time.</p>
      </div>
    );
  }

  if (stage === "consent") {
    return (
      <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
        <h2>PARTICIPANT CONSENT FORM</h2>
        <p><strong>Study Title:</strong> Understanding Audience Responses to Different Advertisements</p>
        <p><strong>Researchers:</strong> Snigdha Pani, Deepti Koranga, Prakash Bhabad</p>
        <p><strong>Institution:</strong> IIIT Hyderabad</p>

        <p>Purpose: You are invited to take part in this study. The purpose is to understand how people perceive and respond to different types of advertisements...</p>

        <div style={{ marginTop: 12 }}>
          <label style={{display:"block", marginBottom:8}}>
            <input type="radio" name="consent" onChange={() => setConsent(true)} /> I Agree to participate in this study
          </label>
          <label style={{display:"block", marginBottom:8}}>
            <input type="radio" name="consent" onChange={() => setConsent(false)} /> I Do Not Agree
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", marginBottom: 8 }}>
            Enter your age (optional): <input type="number" value={ageRaw} onChange={(e)=>setAgeRaw(e.target.value)} style={{width:80}} />
          </label>
          <p style={{ fontSize: 13, color: "#666" }}>Or click Continue and select an age group on the next screen (18-25 or 26-35).</p>
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={handleConsentContinue}>Continue</button>
        </div>
      </div>
    );
  }

  if (stage === "demographics-confirm") {
    return (
      <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
        <h3>Demographics</h3>
        <p>Please select your age group:</p>
        {["18-25", "26-35"].map((g) => (
          <label key={g} style={{ marginRight: 12 }}>
            <input type="radio" name="agegroup" onChange={() => setAgeGroup(g)} /> {g}
          </label>
        ))}

        <div style={{ marginTop: 12 }}>
          <p>Gender:</p>
          {["Male","Female","Other","Prefer not to say"].map((g) => (
            <label key={g} style={{ marginRight: 12 }}>
              <input type="radio" name="gender" onChange={() => setGender(g)} /> {g}
            </label>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <button disabled={!ageGroup || !gender} onClick={assignRandomAdAndPlay}>Start the Video</button>
        </div>
      </div>
    );
  }

  if (stage === "video" && assignedAd) {
    return (
      <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
        <h3>Now watching: {assignedAd.name}</h3>
        <div id="yt-player"></div>
        <p>Please watch the video fully. The survey questions will appear after the video ends.</p>

        <div style={{ marginTop: 12 }}>
          <button onClick={handleMoreInfoClick}>Open product information (opens in new tab)</button>
          <span style={{ marginLeft: 12, color: clickedMoreInfo ? "green" : "#666" }}>{clickedMoreInfo ? "You opened the product page" : "Optional: view product info"}</span>
        </div>
      </div>
    );
  }

  if (stage === "questions") {
    const finalQuestionText = perAdFinalQuestion[assignedAdCode] || "I would search for more information about the product after watching this advertisement.";
    return (
      <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
        <h3>Survey Questions</h3>
        <p>Please rate the following statements:</p>

        {questions.map((q, idx) => (
          <div key={idx} style={{ marginBottom: 14, padding: 10, borderRadius: 6, background: "#fff" }}>
            <div style={{ marginBottom: 8 }}><strong>{q}</strong></div>
            <div>
              {LIKERT.map((label, li) => (
                <label key={li} style={{ marginRight: 12 }}>
                  <input type="radio" name={`q-${idx}`} checked={answers[idx] === li+1} onChange={() => setAnswerFor(idx, li+1)} /> {label}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 12, padding: 10, borderRadius: 6, background: "#fff" }}>
          <div style={{ marginBottom: 8 }}><strong>{finalQuestionText}</strong></div>
          <div>
            {LIKERT.map((label, li) => (
              <label key={li} style={{ marginRight: 12 }}>
                <input type="radio" name="final-search" checked={answers.last === li+1} onChange={() => setLastQuestionAnswer(li+1)} /> {label}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            <button onClick={handleMoreInfoClick}>Open product information</button>
            <span style={{ marginLeft: 12 }}>{assignedAd && <a href={assignedAd.moreInfo} target="_blank" rel="noreferrer">{assignedAd.moreInfo}</a>}</span>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <button onClick={handleSubmit}>Submit responses</button>
        </div>
      </div>
    );
  }

  if (stage === "complete") {
    return (
      <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
        <h2>Thank you!</h2>
        <p>Your responses have been recorded.</p>
        {completionCode && (
          <div style={{ marginTop: 12, padding: 10, background: "#f6f6f6", borderRadius: 6 }}>
            <strong>Completion code:</strong> <span style={{ fontFamily: "monospace" }}>{completionCode}</span>
            <p style={{ fontSize: 13, color: "#666" }}>Please copy this completion code and submit it to the panel (if required).</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}