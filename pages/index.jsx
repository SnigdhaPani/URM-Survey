// pages/index.jsx
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

const EXCEL_URL = "/survey-questions.xlsx"; 
// NOTE: your environment will transform this path into an accessible URL.
// This is the path you uploaded the file to.

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
    moreInfo: "https://www.mi.com/in/product-list/tv/?srsltid=AfmBOoqXmnHU1VFFP7Jb4GlY_eZBIpR7m_fKcfu7A2cSsXdMo20mUkm5",
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

export default function SurveyPage() {
  const [stage, setStage] = useState("consent"); // consent -> demographics -> video -> questions -> thanks
  const [consent, setConsent] = useState(null);
  const [ageGroup, setAgeGroup] = useState(null);
  const [gender, setGender] = useState(null);

  const [assignedAd, setAssignedAd] = useState(null); // object from VIDEO_MAP
  const [assignedAdCode, setAssignedAdCode] = useState(null);
  const [videoStartedAt, setVideoStartedAt] = useState(null);
  const [videoEndedAt, setVideoEndedAt] = useState(null);
  const [watchSeconds, setWatchSeconds] = useState(null);
  const [clickedMoreInfo, setClickedMoreInfo] = useState(false);

  const [questions, setQuestions] = useState([]); // loaded from Excel - Column A used
  const [answers, setAnswers] = useState({}); // questionIndex -> likertIndex (1..5)
  const playerRef = useRef(null);
  const ytPlayerRef = useRef(null);

  // participant id
  const [participantId] = useState("p_" + Math.random().toString(36).slice(2, 9));

  // Load Excel questions on mount
  useEffect(() => {
    async function fetchExcel() {
      try {
        const res = await fetch(EXCEL_URL);
        const arrayBuffer = await res.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // rows as arrays

        // We assume column A has the question text and Column B may be for responses in your spec.
        // We'll read each row and take first column as question. Skip empty rows.
        const qs = json
          .map((r) => (r && r[0] ? String(r[0]).trim() : null))
          .filter((q) => q && q.length > 0);
        setQuestions(qs);
      } catch (err) {
        console.error("Failed to read Excel:", err);
        // fallback: if Excel not reachable, provide a small default list
        setQuestions([
          "This ad made me feel positive about the product.",
          "The ad was memorable.",
          "The ad made the product look trustworthy.",
          "I understood what the ad was trying to say.",
        ]);
      }
    }
    fetchExcel();
  }, []);

  // Randomly assign ad when moving from demographics to video
  function assignRandomAdAndStartVideo() {
    const keys = Object.keys(VIDEO_MAP);
    const k = keys[Math.floor(Math.random() * keys.length)];
    const ad = VIDEO_MAP[k];
    setAssignedAd(ad);
    setAssignedAdCode(k);
    setStage("video");
    // initialize YT player after rendering
    setTimeout(initYouTubePlayer, 300);
  }

  // Initialize YouTube IFrame API player to detect end event
  async function initYouTubePlayer() {
    // make sure script loaded
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      await new Promise((res) => {
        let check = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(check);
            res();
          }
        }, 100);
      });
    }
    // destroy previous player if any
    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy();
      ytPlayerRef.current = null;
    }

    // extract video id from URL
    const vid = extractYouTubeID(assignedAd.yt);
    if (!vid) {
      console.error("Cannot parse YouTube ID for", assignedAd.yt);
      return;
    }

    ytPlayerRef.current = new window.YT.Player("yt-player", {
      height: "360",
      width: "640",
      videoId: vid,
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onStateChange: onPlayerStateChange,
        onReady: () => {
          // autoplay when ready
          setTimeout(() => {
            try {
              ytPlayerRef.current.playVideo();
            } catch {}
          }, 250);
        },
      },
    });
  }

  function extractYouTubeID(url) {
    // rough extract - handles watch?v=, short links, and embed
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) {
        return u.pathname.slice(1);
      }
      if (u.searchParams.has("v")) return u.searchParams.get("v");
      // sometimes t param present, or list/index - fallback: last path token
      const parts = u.pathname.split("/").filter(Boolean);
      return parts.length ? parts[parts.length - 1] : null;
    } catch (err) {
      // fallback patterns
      const m = url.match(/(v=|\/)([A-Za-z0-9_-]{11})/);
      return m ? m[2] : null;
    }
  }

  function onPlayerStateChange(event) {
    // YT Player States: -1 unstarted, 0 ended, 1 playing, 2 paused
    if (event.data === 1) {
      // playing
      setVideoStartedAt(new Date().toISOString());
    } else if (event.data === 0) {
      // ended
      const end = new Date().toISOString();
      setVideoEndedAt(end);
      // compute watched seconds using YT API getCurrentTime if available
      try {
        const secs = Math.round(ytPlayerRef.current.getCurrentTime());
        setWatchSeconds(secs);
      } catch {
        setWatchSeconds(null);
      }
      setStage("questions");
    }
  }

  // record clicking more info
  function handleMoreInfoClick() {
    setClickedMoreInfo(true);
    // open in new tab
    window.open(assignedAd.moreInfo, "_blank", "noopener");
  }

  function handleAnswer(qIndex, likertIndex) {
    setAnswers((a) => ({ ...a, [qIndex]: likertIndex }));
  }

  // final submit
  async function handleSubmit() {
    // package payload
    const responsesObj = {};
    questions.forEach((q, idx) => {
      const val = answers[idx] ?? null;
      responsesObj[q] = val !== null ? LIKERT[val - 1] : null;
    });

    const payload = {
      participantId,
      consent,
      ageGroup,
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

    // send to api
    try {
      const r = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("submit failed");
      setStage("thanks");
    } catch (err) {
      console.error(err);
      alert("Failed to submit, please try again.");
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "16px auto", fontFamily: "Inter, Arial" }}>
      {stage === "consent" && (
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
          <h2>PARTICIPANT CONSENT FORM</h2>

          <p><strong>Study Title:</strong> Understanding Audience Responses to Different Advertisements</p>
          <p><strong>Researchers:</strong> Snigdha Pani, Deepti Koranga, Prakash Bhabad</p>
          <p><strong>Institution:</strong> IIIT Hyderabad</p>

          <h3>Purpose of the Study</h3>
          <p>You are invited to take part in this study. The purpose is to understand how people perceive and respond to different types of advertisements. We are interested in learning what aspects viewers notice, how they interpret the content, and how these elements shape their general impressions of the brands or products shown. This study does not test your knowledge or performance — we are only interested in your natural reactions and opinions.</p>

          <h3>What Participation Involves</h3>
          <ol>
            <li>View short advertisement videos.</li>
            <li>Answer questions about your impressions, feelings, and reactions.</li>
            <li>Provide honest and voluntary feedback.</li>
            <li>Estimated time: 10–15 minutes.</li>
          </ol>

          <h3>Voluntary Participation</h3>
          <p>Your participation is completely voluntary. You may choose not to answer any question and may stop participating at any time without any penalty or consequence.</p>

          <h3>Risks and Benefits</h3>
          <p>Risks: minimal or no risk. Benefits: no direct personal benefit; research contribution.</p>

          <h3>Privacy, Confidentiality & Data Use</h3>
          <ol>
            <li>Your identity will not be collected or linked to your responses.</li>
            <li>All information will be kept confidential and used only for research.</li>
            <li>Responses will be stored securely and will not be published in an identifiable way.</li>
            <li>Data will not be used for any purpose outside this study.</li>
          </ol>

          <h3>Right to Withdraw</h3>
          <p>You may withdraw at any time. If you withdraw, your responses will not be included in the analysis.</p>

          <h3>By selecting “I Agree” you confirm:</h3>
          <ol>
            <li>You have read and understood the information provided.</li>
            <li>Your questions (if any) have been answered.</li>
            <li>You voluntarily agree to participate.</li>
            <li>You understand that you can withdraw at any time without penalty.</li>
          </ol>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              <input type="radio" name="consent" onChange={() => setConsent(true)} /> I Agree to participate in this study
            </label>
            <label style={{ display: "block", marginBottom: 6 }}>
              <input type="radio" name="consent" onChange={() => setConsent(false)} /> I Do Not Agree
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <strong>Contact Information:</strong>
            <p>Researcher Name: Prakash Bhabad<br/>Email: <a href="mailto:prakash.bhabad@students.iiit.ac.in">prakash.bhabad@students.iiit.ac.in</a></p>
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              disabled={consent !== true}
              onClick={() => setStage("demographics")}
              style={{ padding: "8px 12px", marginRight: 8 }}
            >
              Continue (I Agree)
            </button>
            <button
              onClick={() => {
                setConsent(false);
                alert("You chose not to participate. Thank you.");
              }}
              style={{ padding: "8px 12px" }}
            >
              I Do Not Agree
            </button>
          </div>
        </div>
      )}

      {stage === "demographics" && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
          <h3>Demographics</h3>
          <p>Please select your age group:</p>
          <div>
            {["18-25", "26-35"].map((g) => (
              <label key={g} style={{ marginRight: 12 }}>
                <input type="radio" name="age" onChange={() => setAgeGroup(g)} /> {g}
              </label>
            ))}
          </div>

          <p style={{ marginTop: 12 }}>Gender:</p>
          <div>
            {["Male", "Female", "Other", "Prefer not to say"].map((g) => (
              <label key={g} style={{ marginRight: 12 }}>
                <input type="radio" name="gender" onChange={() => setGender(g)} /> {g}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              disabled={!ageGroup}
              onClick={assignRandomAdAndStartVideo}
              style={{ padding: "8px 14px" }}
            >
              Proceed to Video
            </button>
          </div>
        </div>
      )}

      {stage === "video" && assignedAd && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
          <h3>Now watching: {assignedAd.name}</h3>
          <div id="yt-player" />
          <p style={{ marginTop: 12 }}>Please watch the video fully. Questions will appear only after the video ends.</p>
          <div style={{ marginTop: 12 }}>
            <button onClick={handleMoreInfoClick} style={{ padding: "8px 12px", marginRight: 8 }}>
              More information about the product (opens in new tab)
            </button>
            <span style={{ color: clickedMoreInfo ? "green" : "#666" }}>{clickedMoreInfo ? "You opened product info" : "Optional: view product info"}</span>
          </div>
        </div>
      )}

      {stage === "questions" && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
          <h3>Questions</h3>
          <p>Please answer the following statements about the ad:</p>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #eee" }}>Question</th>
                <th style={{ padding: "8px 6px", borderBottom: "1px solid #eee" }}>Response</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, idx) => (
                <tr key={idx}>
                  <td style={{ padding: "8px 6px", verticalAlign: "top", borderBottom: "1px solid #fafafa" }}>{q}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #fafafa" }}>
                    <div>
                      {LIKERT.map((label, li) => (
                        <label key={li} style={{ marginRight: 10 }}>
                          <input
                            type="radio"
                            name={`q-${idx}`}
                            onChange={() => handleAnswer(idx, li + 1)}
                            checked={answers[idx] === li + 1}
                          />{" "}
                          {label}
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}

              {/* Last special question: "I would search for more information..." */}
              <tr>
                <td style={{ padding: "8px 6px" }}>I would search for more information about the mattress after watching this advertisement.</td>
                <td style={{ padding: "8px 6px" }}>
                  {LIKERT.map((label, li) => (
                    <label key={li} style={{ marginRight: 10 }}>
                      <input
                        type="radio"
                        name="final-search"
                        onChange={() => setAnswers((a) => ({ ...a, final_search: li + 1 }))}
                        checked={answers.final_search === li + 1}
                      />{" "}
                      {label}
                    </label>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 12 }}>
            <button onClick={handleSubmit} style={{ padding: "8px 12px" }}>
              Submit responses
            </button>
          </div>
        </div>
      )}

      {stage === "thanks" && (
        <div style={{ background: "#fff", padding: 20, borderRadius: 8 }}>
          <h3>Thank you!</h3>
          <p>Your responses have been recorded. If you have questions contact: prakash.bhabad@students.iiit.ac.in</p>
        </div>
      )}
    </div>
  );
}
